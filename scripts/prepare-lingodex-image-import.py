#!/usr/bin/env python3
"""Build reviewable Supabase CSVs from frozen, read-only source inventories."""
import argparse
import collections
import csv
import hashlib
import io
import json
import pathlib
import re
import uuid
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/image-names/supabase-import"
SOURCES = OUT / "_sources"
NAMESPACE = uuid.UUID("0df21eb4-7e1e-4022-83fd-ae8d666170da")
SHEET_URL = "https://docs.google.com/spreadsheets/d/1Fu7yL_fWsDMT4o-S43aB3Et53jCDLuv_D_JQ-PEPrww/edit?gid=39492845#gid=39492845"
ARCHIVE_FOLDER = "lingodex-unused-images-2026-11-16"
JSON_KW = dict(ensure_ascii=False, separators=(",", ":"))


def json_text(value):
    return json.dumps(value, **JSON_KW)


def csv_text(headers, rows):
    target = io.StringIO(newline="")
    writer = csv.DictWriter(target, fieldnames=headers, lineterminator="\r\n")
    writer.writeheader()
    writer.writerows(rows)
    return target.getvalue()


def col_number(col):
    result = 0
    for c in col:
        result = result * 26 + ord(c) - 64
    return result


def sheet_columns(cells):
    columns = sorted([k[:-1] for k, v in cells.items() if re.fullmatch(r"[A-Z]+1", k) and v and k != "A1"], key=col_number)
    records = {}
    context_cell, context_note, context_artist = None, None, None
    for col in columns:
        note = cells.get(col + "4")
        if note:
            context_cell, context_note = col + "4", note
            if "back to minhs-palette" in note.lower() or "minh's palette" in note.lower():
                context_artist = "minhs-palette"
            elif "anthro" in note.lower():
                context_artist = "beast-city"
        record = dict(column=col, legacy_name=cells[col + "1"], base_prompt=cells.get(col + "3"),
                      variant_prompt=cells.get(col + "5"), photographic_prompt=cells.get(col + "6"),
                      renamed_to=cells.get(col + "7"), context_cell=context_cell,
                      context_note=context_note, context_artist=context_artist)
        for name in (record["legacy_name"], record["renamed_to"]):
            if name:
                if name in records and records[name]["column"] != col:
                    raise ValueError(f"Ambiguous sheet name: {name}")
                records[name] = record
    return records


def filename_prompt(name):
    match = re.search(r"DALL[·•.\-]?E\s+\d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2} - (.*)", name, re.I)
    if match:
        return dict(prompt=match[1], prompt_is_inferred=True, prompt_scope="legacy_filename_description",
                    prompt_may_be_truncated=True, prompt_source={"type": "legacy_filename", "legacy_name": name})
    if re.search(r"_\d{9,}_(?:hd|standard)$", name):
        start = re.search(r"(?:-|_)((?:a|an|the)_)", name, re.I)
        if start:
            prose = re.sub(r"_\d{9,}_(?:hd|standard)$", "", name[start.start() + 1:]).replace("_", " ")
            return dict(prompt=prose, prompt_is_inferred=True, prompt_scope="legacy_filename_description",
                        prompt_may_be_truncated=True, prompt_source={"type": "legacy_filename", "legacy_name": name})
    if not re.match(r"^m\d", name) and len(name.split()) >= 4 and not re.search(r"\bunsplash\b", name, re.I):
        return dict(prompt=name, prompt_is_inferred=True, prompt_scope="legacy_filename_description",
                    prompt_source={"type": "legacy_filename", "legacy_name": name})
    return {}


def original_style(name):
    prose = name.replace("_", " ")
    styles = []
    for label in ("cartoon", "anime", "photographic", "photorealistic", "watercolor", "pixel art"):
        if re.search(r"\b" + re.escape(label) + r"(?:[- ]style|[- ]styled|\s+(?:image|illustration|drawing|depiction))\b", prose, re.I):
            styles.append(label)
    if re.search(r"\bphotorealistic\b", prose, re.I) and "photorealistic" not in styles:
        styles.append("photorealistic")
    return ", ".join(styles) if styles else "legacy-unknown"


def unsplash_credit(name, stages):
    stem = name
    for stage in sorted(set(stages), key=len, reverse=True):
        if stem.startswith(stage + "-"):
            stem = stem[len(stage) + 1:]
            break
    stem = re.sub(r"^m\d+-(?:abstract-(?:describe|objs)|num_adjs|[a-z0-9_]+)-", "", stem)
    match = re.fullmatch(r"(.+)-([A-Za-z0-9_-]{11})-unsplash", stem, re.I)
    if not match:
        raise ValueError(f"Cannot infer Unsplash credit: {name}")
    slug, photo_id = match.groups()
    return {"artist": slug.replace("-", " ").title(), "service": "Unsplash", "source_id": photo_id,
            "source_url": f"https://unsplash.com/photos/{photo_id}", "artist_inferred_from_filename": True}


def prompt_artist(text):
    if not text:
        return None
    if re.search(r"\b(?:anthro|furry)\b", text, re.I):
        return "beast-city"
    if re.search(r"\b(?:photographic|cinematographic)\b", text, re.I):
        return "default-photographic"
    if "no lineart" in text.lower() and "realistic anime" in text.lower():
        return "minhs-palette"
    return None


def metadata_with_evidence(name, artist, associations, sheet, cells):
    """Recover metadata and local evidence; never export this result directly."""
    # Artist folders identify regenerated images; they do not inherit the
    # original's Unsplash/DALL-E provenance merely by sharing its filename.
    human = artist == "original" and "unsplash" in name.lower()
    attribution = unsplash_credit(name, [a["stage"] for a in associations]) if human else {
        "artist": original_style(name) if artist == "original" else artist}
    if human:
        return False, attribution, None
    record = sheet.get(name)
    alias = record.get("alias_match") if record else None
    provenance_name = alias["sheet_legacy_name"] if alias else name
    if artist == "original" and re.search(r"DALL[·•.\-]?E", provenance_name, re.I):
        attribution["service"] = "DALL·E"
    meta = filename_prompt(name) if artist == "original" else {}
    if artist == "original" and not meta and alias:
        meta = filename_prompt(provenance_name)
    if alias:
        meta["legacy_name_alias_evidence"] = alias
    if record and record["base_prompt"]:
        col = record["column"]
        base = record["base_prompt"]
        # This is explicitly a reinterpretation for new variants, never the
        # original image's generation prompt.
        meta["variant_base_prompt"] = {"text": base, "purpose": "reinterpreted_base_for_regenerated_variants",
                                      "is_original_generation_prompt": False,
                                      "source": {"url": SHEET_URL, "cell": col + "3"}}
        if artist != "original":
            prompt, scope, source_cells = base, "reinterpreted_base_only", [col + "3"]
            override = record["photographic_prompt"] if artist == "default-photographic" else record["variant_prompt"]
            override_cell = col + ("6" if artist == "default-photographic" else "5")
            if override and prompt_artist(override) == artist:
                if re.match(r"^(?:ethnicity|style|character style|art style):", override, re.I):
                    prompt = base + "\n\n" + override
                    scope = "reconstructed_base_plus_artist_augmentation"
                else:
                    prompt, scope = override, "saved_variant_override_or_reconstruction"
                source_cells.append(override_cell)
            elif artist == "minhs-palette" and record["context_artist"] == "minhs-palette":
                prompt = base + "\n\n" + cells["B5"]
                scope = "reconstructed_base_plus_shared_artist_template"
                source_cells.append("B5")
            meta.update(prompt=prompt, prompt_is_inferred=True, prompt_scope=scope,
                        prompt_source={"type": "legacy_prompt_sheet", "url": SHEET_URL, "cells": source_cells})
            if record["context_note"]:
                meta["sheet_artist_context"] = {"cell": record["context_cell"], "note": record["context_note"]}
    return True, attribution, meta or None


def database_metadata(is_ai, attribution_evidence, prompt_evidence):
    """The user-approved allowlists for the actual image_files JSON fields."""
    attribution = {k: attribution_evidence[k] for k in ("artist", "service", "source_url") if k in attribution_evidence}
    if not is_ai:
        return attribution, None
    ai_meta = {}
    if prompt_evidence and prompt_evidence.get("prompt"):
        ai_meta = {k: prompt_evidence[k] for k in ("prompt", "prompt_is_inferred", "prompt_may_be_truncated") if k in prompt_evidence}
    return attribution, ai_meta


def build():
    map_path = ROOT / "docs/image-names/old-to-new.v2.tsv"
    with map_path.open(newline="", encoding="utf8") as stream:
        names = list(csv.DictReader(stream, delimiter="\t"))
    assert len({r["old_name"] for r in names}) == len({r["new_name"] for r in names}) == len(names)
    audit = {r["old_name"]: r for r in map(json.loads, (ROOT / "docs/image-names/audit.jsonl").read_text().splitlines())}
    inventory = json.loads((SOURCES / "s3-inventory.json").read_text())
    existing = json.loads((SOURCES / "existing-ids.json").read_text())
    cells = json.loads((SOURCES / "prompt-sheet.json").read_text())["cells"]
    sheet = sheet_columns(cells)
    active = {r["old_name"] for r in names}
    # Two old prompt-sheet names were renamed in the live content. Recover their
    # metadata only when the originals have the same non-multipart MD5 ETag and
    # byte size, and the sheet record is unambiguous. Do not merge their image sets.
    originals = next(g for g in inventory if "lingoframe-compressed-jpgs-v3/" in g["prefix"])
    by_name, by_signature = {}, collections.defaultdict(list)
    for obj in originals["objects"]:
        old = obj["key"][len(originals["prefix"]):].rsplit(".", 1)[0]
        by_name[old] = obj
        if re.fullmatch(r'"[0-9a-f]{32}"', obj["etag"]):
            by_signature[(obj["etag"], obj["size"])].append(old)
    aliases = []
    for name in sorted(active - sheet.keys()):
        obj = by_name.get(name)
        if not obj:
            continue
        candidates = {sheet[n]["column"]: sheet[n] for n in by_signature[(obj["etag"], obj["size"])] if n in sheet}
        if len(candidates) == 1:
            record = next(iter(candidates.values()))
            alias = {"sheet_legacy_name": record["legacy_name"], "current_legacy_name": name,
                     "match_basis": "original_object_md5_etag_and_byte_size", "etag": obj["etag"], "bytes": obj["size"]}
            sheet[name] = {**record, "alias_match": alias}
            aliases.append(alias)
    objects = collections.defaultdict(list)
    unused = []
    for group in inventory:
        original = "lingoframe-compressed-jpgs-v3/" in group["prefix"]
        for obj in group["objects"]:
            relative = obj["key"][len(group["prefix"]):]
            artist, filename = ("original", relative) if original else relative.split("/", 1)
            name, extension = filename.rsplit(".", 1)
            assert extension.lower() in {"jpg", "jpeg", "png", "webp", "gif"}
            item = {**obj, "artist": artist, "old_name": name, "extension": extension.lower()}
            if name in active:
                objects[name].append(item)
            else:
                unused.append(item)
    sets, files, review, evidence = [], [], [], []
    all_ids = set()
    reserved = set(existing["image_sets"]) | set(existing["image_files"])
    artist_counts, scope_counts = collections.Counter(), collections.Counter()
    for row in names:
        name = row["old_name"]
        set_id = str(uuid.uuid5(NAMESPACE, "image_set:" + name))
        assert set_id not in reserved and set_id not in all_ids
        all_ids.add(set_id)
        sets.append({"id": set_id, "ref": json_text({"type": "lingodex", "key": row["new_name"]})})
        candidates = sorted(objects[name], key=lambda o: (o["artist"] != "original", o["artist"], o["key"]))
        assert sum(o["artist"] == "original" for o in candidates) == 1, name
        for obj in candidates:
            file_id = str(uuid.uuid5(NAMESPACE, "image_file:s3://designjams/" + obj["key"]))
            assert file_id not in reserved and file_id not in all_ids
            all_ids.add(file_id)
            is_ai, attribution_evidence, prompt_evidence = metadata_with_evidence(name, obj["artist"], audit[name]["associations"], sheet, cells)
            attribution, ai_meta = database_metadata(is_ai, attribution_evidence, prompt_evidence)
            record = {"id": file_id, "image_set_id": set_id, "filename": "original." + obj["extension"],
                      "is_ai": "true" if is_ai else "false", "attribution": json_text(attribution),
                      "ai_meta": json_text(ai_meta) if ai_meta is not None else "", "is_archived": "false"}
            files.append(record)
            artist_counts[obj["artist"]] += 1
            if ai_meta and "prompt" in ai_meta:
                scope_counts[prompt_evidence["prompt_scope"]] += 1
            review.append({"new_name": row["new_name"], "legacy_name": name, "source_artist": obj["artist"],
                           "source": {"bucket": "designjams", "key": obj["key"]},
                           "image_set_id": set_id, "image_file_id": file_id, "is_ai": is_ai,
                           "attribution": attribution, "ai_meta": ai_meta,
                           "destination": f"s3://omnilingual-access/images/camplingo/{file_id}/original.{obj['extension']}"})
            evidence.append({"image_file_id": file_id, "source": {"bucket": "designjams", "key": obj["key"]},
                             "attribution_evidence": attribution_evidence, "prompt_evidence": prompt_evidence})
    unused.sort(key=lambda x: (x["artist"] != "original", x["artist"], x["key"]))
    for i, item in enumerate(unused, 1):
        subdir = "originals" if item["artist"] == "original" else "variants/" + item["artist"]
        item["archive_path"] = f"{ARCHIVE_FOLDER}/{subdir}/{i:06}.{item['extension']}"
        assert ".." not in pathlib.PurePosixPath(item["archive_path"]).parts
    report = {"project_id": "nhveqhrjqgpibkesqsti", "name_map": "old-to-new.v2.tsv",
              "name_map_sha256": hashlib.sha256(map_path.read_bytes()).hexdigest(), "uuid_namespace": str(NAMESPACE),
              "image_sets": len(sets), "image_files": len(files), "source_artist_counts": dict(artist_counts),
              "human_files": sum(r["is_ai"] == "false" for r in files),
              "ai_files": sum(r["is_ai"] == "true" for r in files),
              "prompt_scopes": dict(scope_counts), "files_with_ai_meta": sum(bool(r["ai_meta"]) for r in files),
              "files_with_prompt": sum(bool(r["ai_meta"] and json.loads(r["ai_meta"]).get("prompt")) for r in files),
              "ai_files_with_empty_ai_meta": sum(r["is_ai"] == "true" and json.loads(r["ai_meta"]) == {} for r in files),
              "variant_files_with_empty_ai_meta": sum(r["source_artist"] != "original" and r["ai_meta"] == {} for r in review),
              "human_files_with_null_ai_meta": sum(r["is_ai"] == "false" and not r["ai_meta"] for r in files),
              "prompt_sheet_aliases": aliases,
              "legacy_unknown_artist": sum(json.loads(r["attribution"])["artist"] == "legacy-unknown" for r in files),
              "checked_existing_image_sets": len(existing["image_sets"]),
              "checked_existing_image_files": len(existing["image_files"]), "uuid_conflicts": 0,
              "unused_originals": sum(r["artist"] == "original" for r in unused),
              "unused_variants": sum(r["artist"] != "original" for r in unused),
              "archive_image_bytes": sum(r["size"] for r in unused)}
    outputs = {"image_sets.csv": csv_text(["id", "ref"], sets),
               "image_files.csv": csv_text(["id", "image_set_id", "filename", "is_ai", "attribution", "ai_meta", "is_archived"], files),
               "report.json": json.dumps(report, ensure_ascii=False, indent=2) + "\n",
               "review.jsonl": "".join(json_text(r) + "\n" for r in review),
               "_sources/metadata-evidence.jsonl": "".join(json_text(r) + "\n" for r in evidence),
               "_sources/archive-plan.json": json.dumps(unused, ensure_ascii=False, indent=2) + "\n"}
    return outputs, report, sheet


def finalize_archive(destination, staging):
    plan = json.loads((SOURCES / "archive-plan.json").read_text())
    sheet = sheet_columns(json.loads((SOURCES / "prompt-sheet.json").read_text())["cells"])
    manifest = []
    prompt_notes = {}
    for obj in plan:
        local = staging / obj["archive_path"]
        data = local.read_bytes()
        sha = hashlib.sha256(data).hexdigest()
        receipt = json.loads(local.with_suffix(local.suffix + ".metadata.json").read_text())
        assert len(data) == obj["size"] and sha == receipt["sha256"]
        assert receipt["key"] == obj["key"] and receipt["etag"] == obj["etag"]
        manifest.append({"archive_path": obj["archive_path"], "source_bucket": "designjams", "source_key": obj["key"],
                         "legacy_name": obj["old_name"], "artist": obj["artist"], "bytes": len(data),
                         "sha256": sha, "etag": obj["etag"], "last_modified": obj["last_modified"]})
        if obj["old_name"] in sheet:
            prompt_notes[obj["old_name"]] = sheet[obj["old_name"]]
    readme = ("Unused Lingodex images\n\n"
              "Scope: 312 originals and 5 artist variants outside the current 3,339-name map.\n"
              "All image bytes are retained without editing or conversion.\n"
              "Short numbered archive filenames avoid legacy filenames that exceed filesystem limits.\n"
              "manifest.csv retains each exact S3 bucket/key, legacy name, size, ETag, modification time, and SHA-256.\n"
              "prompt-sheet-notes.json retains the matching sheet records, including the two photographic prompt/rename examples.\n"
              "The unrelated 'LingoFrame compressed jpgs/' prefix is outside this archive scope.\n"
              "No S3 objects or Supabase records were changed.\n")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite existing archive: {destination}")
    temp = destination.with_suffix(".partial.zip")
    with zipfile.ZipFile(temp, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as z:
        for obj in plan:
            z.write(staging / obj["archive_path"], obj["archive_path"])
        z.writestr(ARCHIVE_FOLDER + "/manifest.csv", csv_text(list(manifest[0]), manifest))
        z.writestr(ARCHIVE_FOLDER + "/prompt-sheet-notes.json", json.dumps(prompt_notes, ensure_ascii=False, indent=2))
        z.writestr(ARCHIVE_FOLDER + "/README.txt", readme)
    with zipfile.ZipFile(temp) as z:
        assert z.testzip() is None
        assert len(z.namelist()) == len(plan) + 3 and len(set(z.namelist())) == len(z.namelist())
    temp.rename(destination)
    print(json.dumps({"archive": str(destination), "images": len(plan), "bytes": destination.stat().st_size,
                      "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--finalize-archive", type=pathlib.Path)
    parser.add_argument("--staging", type=pathlib.Path, default=pathlib.Path("/tmp/lingodex-unused-archive-2026-11-16"))
    args = parser.parse_args()
    if args.finalize_archive:
        finalize_archive(args.finalize_archive, args.staging)
        return
    outputs, report, _ = build()
    for filename, content in outputs.items():
        target = OUT / filename
        data = content.encode("utf8")
        if args.check:
            assert target.read_bytes() == data, f"Stale file: {filename}"
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
