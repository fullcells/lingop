import collections
import csv
import hashlib
import importlib.util
import io
import json
import pathlib
import sys
import unittest
import uuid
import zipfile

SCRIPT = pathlib.Path(__file__).with_name("prepare-lingodex-image-import.py")
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("lingodex_import", SCRIPT)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class ImageImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.outputs, cls.report, cls.sheet = module.build()
        cls.sets = list(csv.DictReader(io.StringIO(cls.outputs["image_sets.csv"])))
        cls.files = list(csv.DictReader(io.StringIO(cls.outputs["image_files.csv"])))
        cls.review = [json.loads(s) for s in cls.outputs["review.jsonl"].splitlines()]
        cls.evidence = {r["image_file_id"]: r for r in map(json.loads, cls.outputs["_sources/metadata-evidence.jsonl"].splitlines())}
        cls.inventory = json.loads((module.SOURCES / "s3-inventory.json").read_text())
        cls.existing = json.loads((module.SOURCES / "existing-ids.json").read_text())

    def test_exact_coverage_refs_and_foreign_keys(self):
        with (module.ROOT / "docs/image-names/old-to-new.v2.tsv").open(encoding="utf8", newline="") as stream:
            names = list(csv.DictReader(stream, delimiter="\t"))
        self.assertEqual(len(self.sets), 3339)
        self.assertEqual(len(self.files), 3534)
        self.assertEqual({json.loads(s["ref"])["key"] for s in self.sets}, {n["new_name"] for n in names})
        self.assertTrue(all(set(json.loads(s["ref"])) == {"type", "key"} and json.loads(s["ref"])["type"] == "lingodex" for s in self.sets))
        set_ids = {s["id"] for s in self.sets}
        self.assertEqual({f["image_set_id"] for f in self.files}, set_ids)
        source_keys = [r["source"]["key"] for r in self.review]
        self.assertEqual(len(set(source_keys)), len(source_keys))
        self.assertEqual(collections.Counter(r["source_artist"] for r in self.review),
                         {"original": 3339, "minhs-palette": 101, "beast-city": 55, "default-photographic": 39})

    def test_ids_are_valid_unique_and_do_not_conflict_with_either_live_table_snapshot(self):
        ids = [s["id"] for s in self.sets] + [f["id"] for f in self.files]
        self.assertEqual(len(ids), len(set(ids)))
        for value in ids:
            self.assertEqual(str(uuid.UUID(value)), value)
        self.assertFalse(set(ids) & (set(self.existing["image_sets"]) | set(self.existing["image_files"])))

    def test_schema_constraints_and_defaults(self):
        self.assertTrue(all(set(s) == {"id", "ref"} for s in self.sets))
        for row in self.files:
            self.assertEqual(row["filename"], "original.jpg")
            self.assertIn(row["is_ai"], {"true", "false"})
            self.assertEqual(row["is_archived"], "false")
            self.assertNotIn("created_at", row)
            self.assertNotIn("priority", row)
            attribution = json.loads(row["attribution"])
            self.assertTrue(isinstance(attribution, dict) and isinstance(attribution["artist"], str) and attribution["artist"].strip())
            self.assertLessEqual(set(attribution), {"artist", "service", "source_url"})
            if row["is_ai"] == "true":
                self.assertTrue(row["ai_meta"])
                ai_meta = json.loads(row["ai_meta"])
                self.assertIsInstance(ai_meta, dict)
                self.assertLessEqual(set(ai_meta), {"prompt", "prompt_is_inferred", "prompt_may_be_truncated"})
            else:
                self.assertEqual(row["ai_meta"], "")

    def test_human_and_ai_provenance_are_not_inherited_across_artist_variants(self):
        human = [r for r in self.review if not r["is_ai"]]
        self.assertEqual(len(human), 12)
        for row in human:
            self.assertEqual(row["source_artist"], "original")
            self.assertIn("unsplash", row["legacy_name"])
            self.assertEqual(row["attribution"]["service"], "Unsplash")
            self.assertTrue(self.evidence[row["image_file_id"]]["attribution_evidence"]["artist_inferred_from_filename"])
            self.assertTrue(row["attribution"]["source_url"].startswith("https://unsplash.com/photos/"))
            self.assertIsNone(row["ai_meta"])
        for row in self.review:
            if row["source_artist"] != "original":
                self.assertTrue(row["is_ai"])
                self.assertEqual(row["attribution"]["artist"], row["source_artist"])
                self.assertNotIn("service", row["attribution"])

    def test_prompt_claims_are_explicitly_inferred_and_reinterpretations_do_not_become_original_prompts(self):
        for row in self.review:
            meta = row["ai_meta"] or {}
            if "prompt" in meta:
                self.assertIs(meta["prompt_is_inferred"], True)
                evidence = self.evidence[row["image_file_id"]]["prompt_evidence"]
                self.assertEqual(meta["prompt"], evidence["prompt"])
                self.assertTrue(evidence["prompt_source"])
            if row["source_artist"] == "original" and "prompt" in meta:
                self.assertEqual(self.evidence[row["image_file_id"]]["prompt_evidence"]["prompt_source"]["type"], "legacy_filename")
            self.assertNotIn("variant_base_prompt", meta)
        self.assertEqual(len(self.report["prompt_sheet_aliases"]), 2)
        self.assertEqual(self.sheet["girl-playing-video-game"]["column"], "FB")
        self.assertEqual(self.sheet["woman-playing-video-game"]["column"], "FC")

    def test_missing_ai_prompts_are_empty_objects_and_evidence_is_local_only(self):
        self.assertEqual(sum(r["source_artist"] != "original" and r["ai_meta"] == {} for r in self.review), 38)
        self.assertEqual(sum(r["is_ai"] and r["ai_meta"] == {} for r in self.review), 2225)
        self.assertEqual(sum((r["ai_meta"] or {}).get("prompt_may_be_truncated", False) for r in self.review), 1075)
        self.assertEqual(sum(r["attribution"].get("service") == "DALL·E" for r in self.review), 336)
        self.assertNotIn(module.SHEET_URL, self.outputs["image_files.csv"])
        self.assertNotIn("legacy_source", self.outputs["image_files.csv"])
        for row in self.review:
            if row["source_artist"] == "original":
                raw = self.evidence[row["image_file_id"]]["prompt_evidence"] or {}
                if not raw.get("prompt"):
                    self.assertEqual(row["ai_meta"], {} if row["is_ai"] else None)

    def test_paths_reconstruct_from_exported_fields_and_name_map_without_legacy_source(self):
        with (module.ROOT / "docs/image-names/old-to-new.v2.tsv").open(encoding="utf8", newline="") as stream:
            old_by_new = {r["new_name"]: r["old_name"] for r in csv.DictReader(stream, delimiter="\t")}
        keys_by_set = {r["id"]: json.loads(r["ref"])["key"] for r in self.sets}
        variant_artists = {"beast-city", "minhs-palette", "default-photographic"}
        actual_sources = {r["image_file_id"]: r["source"]["key"] for r in self.review}
        reconstructed = set()
        for row in self.files:
            artist = json.loads(row["attribution"])["artist"]
            prefix = "lingoframe-20240718/compressed-jpgs/" + artist + "/" if artist in variant_artists else "lingoframe-20240718/lingoframe-compressed-jpgs-v3/"
            key = prefix + old_by_new[keys_by_set[row["image_set_id"]]] + "." + row["filename"].rsplit(".", 1)[1]
            self.assertEqual(key, actual_sources[row["id"]])
            reconstructed.add(key)
        self.assertEqual(len(reconstructed), 3534)

    def test_complete_csvs_roundtrip_and_regenerate_identically(self):
        outputs_again, _, _ = module.build()
        self.assertEqual(self.outputs, outputs_again)
        for filename, content in self.outputs.items():
            self.assertEqual((module.OUT / filename).read_bytes(), content.encode("utf8"))
        for rows in (self.sets, self.files):
            self.assertTrue(all(None not in r and None not in r.values() for r in rows))

    def test_desktop_archive_is_complete_and_byte_checksums_match(self):
        archive = pathlib.Path("/Users/hanleyweng/Desktop/lingodex-unused-images-2026-11-16.zip")
        if not archive.is_file():
            self.skipTest("Previously created Desktop archive is not at its original path; CSV validation is independent.")
        plan = json.loads(self.outputs["_sources/archive-plan.json"])
        with zipfile.ZipFile(archive) as z:
            self.assertIsNone(z.testzip())
            root = module.ARCHIVE_FOLDER + "/"
            manifest = list(csv.DictReader(io.StringIO(z.read(root + "manifest.csv").decode("utf8"))))
            self.assertEqual(len(manifest), 317)
            self.assertEqual(len(z.namelist()), 320)
            self.assertEqual(sum(r["artist"] == "original" for r in manifest), 312)
            self.assertEqual(sum(r["artist"] != "original" for r in manifest), 5)
            self.assertEqual({r["source_key"] for r in manifest}, {r["key"] for r in plan})
            imported = {r["source"]["key"] for r in self.review}
            self.assertFalse(imported & {r["source_key"] for r in manifest})
            for row in manifest:
                image = z.read(row["archive_path"])
                self.assertEqual(len(image), int(row["bytes"]))
                self.assertEqual(hashlib.sha256(image).hexdigest(), row["sha256"])
            notes = json.loads(z.read(root + "prompt-sheet-notes.json"))
            self.assertEqual(notes["cat-dog-cat-indoors"]["photographic_prompt"].split("\n")[0],
                             "three animals. from left to right: a cat, a dog, and then another cat. indoors.")


if __name__ == "__main__":
    unittest.main()
