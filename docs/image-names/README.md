# Lingodex image metadata name proposals

[old-to-new.tsv](./old-to-new.tsv) contains one row per distinct, nonempty `i1`–`i5` value in the pre-migration `src/content/lingodex.ts`. Its two columns are `old_name` and `new_name`. Old identifiers are preserved exactly. Proposed metadata names use lowercase words and spaces, without a file extension.

This directory preserves the original naming proposal and the revised map used for the [completed migration](./supabase-import/README.md).

An additional [revised preview](./PREVIEW.md) removes filler, recovers useful scene keywords from longer filenames, and uses digits for quantities. It includes a side-by-side comparison and a separate `old-to-new.v2.tsv`; the counts and original algorithm below describe the first proposal.

## Current result

- 3,339 unique images across 1,196 entries.
- 214 names adopted from readable filenames; 3,125 derived from question–answer text.
- 102 duplicate names receive numbered suffixes.
- All base names contain at most ten words. No current names require the generic keyword fallback.
- 4,104 reachable question variants, including 4,071 with an image and 33 without one.

[audit.jsonl](./audit.jsonl) records each proposed name, its naming rule, its selected question–answer pair (when applicable), and **all** associated display pairs, including their devrefs, one-based variant numbers, and selected image/question fields. Filename names and names for weekly collections have no single selected pair. [summary.json](./summary.json) records counts and the SHA-256 of the exact source file.

## Deterministic rules

1. Load the legacy TypeScript from Git revision `568dab8f27b41bd807ec8a642eaf9f5716e77571` through the existing `jiti` dependency. Use a checkout whose history includes that revision. Current lesson data already contains the migrated refs.
2. Enumerate variants using `numLingoDexEntryVariants(entry)`, just as the project does. This counts nonempty question and image fields, **not** answer fields or the highest populated field number.
3. For variant `N`, associate the image `iN || i1` with question `qN || q1` and correct answer `aN`. Do not include other answer choices as if they describe that image. An empty image is skipped. This follows `projects/lingodex/lib/session/image.ts` and `projects/lingodex/components/lingodex/LingoDexEntryVariantView.tsx`, rather than the separate `uniqueTexts1stMeta` index, whose image carry-forward behavior differs.
4. Prefer a short, standalone descriptive filename when it can be converted directly. For example, `man-what-this-cat` becomes `man what this cat`. Convert underscores/hyphens to spaces and remove old `•N` duplicate suffixes. Reject curriculum-prefixed names, UUIDs, download labels, timestamps, emoji-only identifiers, image-service names, and long prompts.
5. Otherwise fill English question slots with the correct answer. Strip articles, copulas, possessives, and question scaffolding. Preserve actions, attributes, quantities, relationships, comparisons, and negation. For example:

   | Question | Answer | Base name |
   | --- | --- | --- |
   | What color is the flower? | red | flower red |
   | Who is behind the man reading? | a woman | woman behind man reading |
   | Who is the woman saving? | a man | woman saving man |
   | Is the world flat? | No | world not flat |
   | What flavor of ice-cream is the person eating? | chocolate | person eating chocolate ice cream |

   An explicit question-level template table handles educational questions such as asking the time, identifying vocabulary, or interpreting a calendar. No runtime AI, image recognition, network calls, or image-specific name overrides are used. Normalization includes a small explicit spelling table and preserves math operators as words.

6. Pronouns without an explicit subject become `person` or `people`; `he`/`she` alone do not establish adulthood. An explicit noun in the question supplies the subject when available. A chart associated with at least four distinct weekdays becomes, for example, `man weekly activities`.
7. For other images with multiple pairs, rank candidate phrases deterministically: generic keyword fallbacks receive −20; unresolved question words or `you` receive −10; activity/action/statement rules receive +2; add up to eight points for word count; subtract three per word beyond ten. Ties use the candidate name, devref, and variant number in that order. This favors a useful description while retaining every alternative pair in the audit. Names are not arbitrarily truncated to meet a length limit.
8. Sort exact old identifiers with JavaScript's locale-independent string comparison. The first occurrence of an identical normalized base name keeps it; subsequent distinct images receive ` #2`, ` #3`, etc. Each old identifier appears exactly once, and each final new name is unique.

Reordering entries does not change the output. Repeating generation with the same source and rules produces byte-identical files. Changing source text, naming rules, or the membership of a collision group can change names or suffixes; this proposal is a reproducible snapshot rather than an append-only identifier registry.

The names describe the associated text. A question–answer pair can omit visible details or describe only one part of a composite image; the audit preserves the other associations for review. Different synonyms or wordings are not automatically treated as identical base names.

## Regenerate and verify

Run from `foundations/lingop`:

```sh
npm run generate:lingodex-image-names
npm run test:lingodex-image-names
npm run check:lingodex-image-names
```

The check command compares all generated files byte for byte without rewriting them. The tests verify display pairing and fallbacks, exclusion of distractors, question slot filling, negation, counts, collisions, source-order independence, complete image coverage, and TSV escaping.
