# Lingodex Supabase import files

This batch has been uploaded to the existing Camp Lingo Suite project (`nhveqhrjqgpibkesqsti`). A read-only comparison confirmed all 3,339 sets and 3,534 files exactly match the final CSV payloads, excluding server-generated timestamp values, which were checked for presence. See `upload-verification.json` for the verification record.

Keep these CSVs and the migration records for reference. The import order was **image_sets.csv first**, then **image_files.csv**. The metadata generator does not write to Supabase or copy images; the separate S3 copy is now complete.

| File | Rows | Contents |
| --- | ---: | --- |
| image_sets.csv | 3,339 | Generated UUID text IDs and exactly `{ "type": "lingodex", "key": new_name }` refs, using the revised v2 names |
| image_files.csv | 3,534 | 3,339 originals, 101 minhs-palette, 55 beast-city, and 39 default-photographic files |

Every file uses `original.jpg`, matching the actual source inventory. Each copied file is stored at:

```text
s3://omnilingual-access/images/camplingo/<image_files.id>/original.jpg
```

The S3 copy completed on 2026-11-16: 3,534 new objects, totaling 300,914,594 bytes. All files passed source-ETag and byte-size comparisons, destination SHA-256 checks, and unsigned public-URL HEAD checks. The canary also passed an unsigned GET with body checksum verification. All 3,534 source images and the 1,069 pre-existing destination images plus one directory marker were preserved. No database records or bucket policies were changed.

See `s3-copy/completion-verification.json` for the final audit summary, `s3-copy/report.json` for the completed run, and `s3-copy/database-verification.json` for the final read-only Supabase comparison. The live database still exactly matches the imported CSVs. `s3-copy/plan.json` records every source and destination; `s3-copy/receipts.jsonl` records individual checksum and public-access results. The run reused 439 images copied during the canary and the first portion of the batch, then copied the remaining 3,095; all 3,534 destinations were absent from the original baseline.

The database payload does not contain legacy source paths or migration evidence. For this batch, every source path reconstructs exactly from `image_set_id` → `image_sets.ref.key` → the frozen `old-to-new.v2.tsv` map, plus the artist-folder rules and filename extension. The three named variant artists use `compressed-jpgs/<artist>/`; all other artist values in this batch identify originals in `lingoframe-compressed-jpgs-v3/`.

For local review and historical tracing, `review.jsonl` separately retains source-to-destination paths alongside the decoded database metadata. `_sources/metadata-evidence.jsonl` retains the supporting spreadsheet cells, aliases, and credit/prompt inferences. Neither JSONL file is an import payload. Keep the frozen map and these migration records for historical tracing.

## Defaults and attribution

- The CSVs omit `updated_at`, `created_at`, and `priority`, allowing the database's timestamp defaults and NULL priority to apply. `is_archived` is explicitly `false`.
- Every AI file has an object in `ai_meta`. Files without prompt text use `{}`, including the 38 variants without recorded prompts. The twelve non-AI files have an empty CSV field representing SQL NULL.
- Attribution has exactly the approved allowlist: `artist`, optional `service`, and `source_url` for Unsplash photographs. It contains no `legacy_source`, `source_id`, inference markers, or separate style field.
- Twelve current Unsplash originals have `is_ai=false`. Artist names and Unsplash URLs are inferred from their filenames; the inference evidence stays in the local audit. No licence or other unrecorded facts are invented.
- All remaining 3,522 files have `is_ai=true`.
- Artist variants keep their exact folder names as `attribution.artist`. Original files with an explicit rendering style use that style as the artist. Unknown original styles use the user-selected `legacy-unknown`.
- The 336 originals with DALL·E filename evidence retain the user-selected `attribution.service="DALL·E"` convention. Regenerated variants do not inherit their originals' service or human provenance. Unknown services and models are omitted.

## Prompt data

Database `ai_meta` has only these approved fields when prompt text is available:

```json
{
  "prompt": "The complete available prompt text, including any applicable augmentation.",
  "prompt_is_inferred": true
}
```

For the 1,075 original filename descriptions that may be truncated, `prompt_may_be_truncated=true` is also retained. Their recovered text is preserved verbatim; no missing text is invented. Files without prompt text have `{}` for AI or SQL NULL for non-AI.

There are 1,297 files with prompt text and 2,225 AI files with empty metadata objects. `ai_meta` contains no spreadsheet URLs, cell references, source/alias records, prompt scopes, artist-switch notes, or separate base-prompt objects.

The prompt sheet's row 3 is a **reinterpretation for generating variants**, not the original generation prompt. For variants, it contributes to the single prompt string. It is not placed on original images as their prompt. Original images without an original filename-derived prompt have `{}`, even if related variant data exists in the local audit.

For variants:

- Matching row-5 artist overrides/augmentations are merged into the single prompt string. Cell references remain only in the local evidence file.
- Minh's Palette's shared B5 template is combined with the base prompt only within its indicated artist context.
- Where an artist's full recipe is unknown, the complete available reinterpreted base is stored as the inferred prompt, without adding an unsupported augmentation.
- Row-4 artist-switch notes inform reconstruction and stay in the local audit. They do not override the actual S3 artist folder.

Two sheet filenames were renamed to `girl-playing-video-game` and `woman-playing-video-game`. Their original objects have matching MD5 ETags and byte sizes, permitting unambiguous prompt-sheet alias matches. That evidence remains only in the local audit; their image sets remain separate and unchanged.

The sheet's two row-6 photographic examples and row-7 renames refer to images outside the current name map. They are excluded from these CSVs under the user's current-images-only choice, and their sheet notes are retained in the Desktop archive.

## IDs and validation

IDs are reproducible UUIDv5 values generated within this migration's fixed UUID namespace: sets are keyed by the exact old identifier, and files by their exact source S3 bucket/key. IDs do not depend on display names or row order. Both sets of generated IDs were checked against both tables' pre-import IDs and against each other. The pre-import read found 471 existing image sets, 1,068 image files, and no existing Lingodex sets; no generated UUID conflicts were found. The frozen pre-import ID snapshot remains part of the reproducible export inputs.

Validation covers complete source coverage, exact refs, foreign keys, unique IDs, schema constraints, JSON/CSV round trips, approved field allowlists, empty AI objects versus non-AI NULLs, source-path reconstruction without uploaded legacy fields, prompt-inference flags, and repeatable output. Source inventories and the relevant prompt cells are frozen under `_sources/`; they contain no credentials.

## Unused-image archive

The user-requested archive was created and verified at this Desktop path:

```text
/Users/hanleyweng/Desktop/lingodex-unused-images-2026-11-16.zip
```

It was verified to contain 312 unused originals and five unused artist variants, plus a manifest, prompt-sheet notes, and README. All 317 images were retained byte-for-byte without editing. Short portable archive filenames avoid legacy filename length limits; the manifest preserves exact original S3 keys, file sizes, ETags, modification dates, and SHA-256 hashes. The unrelated `LingoFrame compressed jpgs/` prefix is outside this scope. The archive test is optional when the ZIP is no longer at that path; metadata regeneration does not recreate or overwrite the archive.

From `foundations/lingop`, reproduce/check the metadata with:

```sh
python3 scripts/prepare-lingodex-image-import.py
python3 scripts/prepare-lingodex-image-import.py --check
python3 scripts/test-lingodex-image-import.py
```

The copy script loads the existing Lingodex project's local AWS configuration without logging credentials. Its default mode is preflight only. Run it from the LanguageLab root:

```sh
node foundations/lingop/scripts/copy-lingodex-images.mjs --preflight
```

The completed copy used `--execute` (and `--execute --limit 1` for the canary). Copies pin each source ETag and use destination `If-None-Match: *`, so a conflicting object cannot be overwritten. A resumed run verifies matching destinations and reuses them. The script has no source-delete operation. Source metadata is preserved, destination access follows the application's existing `public-read` convention, and S3 computes a SHA-256 checksum for each copied object.
