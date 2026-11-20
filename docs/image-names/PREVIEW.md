# Revised naming preview

The revised proposal applies the user's two selected preferences:

- Keep main subjects and distinctive context. Include details such as a green door, a flying plane, or a farmer with dry crops. Usually omit incidental scenery and ordinary serving containers.
- Use digits for quantities, such as `22 players` instead of `twenty two players`.

The first proposal remains in `old-to-new.tsv`. These are the revised outputs:

- [simplification-preview.tsv](./simplification-preview.tsv): all 3,339 rows, with current and proposed names, word counts, change reasons, and recovered source details.
- [longest-preview.tsv](./longest-preview.tsv): the 50 longest names from the first proposal, with their replacements.
- [old-to-new.v2.tsv](./old-to-new.v2.tsv): the frozen two-column map used for the [completed migration](./supabase-import/README.md).
- [preview-summary.json](./preview-summary.json): the measured effect of this pass.

`original_tsv_line` refers to the original map's physical line number, including its header. This preserves the user's references to lines 21, 26, and 35.

## Effect

| Measure | First proposal | Revised proposal |
| --- | ---: | ---: |
| Unique names | 3,339 | 3,339 |
| Average words | 3.76 | 3.83 |
| Maximum words | 10 | 9 |
| Average words for the original 50 longest names | 8.52 | 6.58 |
| Names requiring numbered suffixes | 102 | 88 |

615 names change: 104 get shorter, 357 get longer, and 154 change without changing their word count. The modest increase in the overall average comes from recovering missing subjects and objects. 171 names gain a more specific subject, 42 regain object attributes, and 313 gain source details; those categories overlap.

## Examples

| Original line | Current name | Revised name |
| ---: | --- | --- |
| 3 | a bird playing a blue piano | bird playing blue piano |
| 21 | fastest vehicle white | car passing cyclist plane flying |
| 26 | white dog at end of street | white dog at street end green door |
| 31 | a group of diverse men hiking | men hiking |
| 35 | person hoping for rain | farmer hoping for rain dry crops |
| — | a fantasy hero thinking and choosing which door to open | fantasy hero choosing door |
| — | a group of students in school uniform inside a museum | students in school uniform in museum |
| — | man on left reading book to sleeping girl on right | man left reading book to sleeping girl right |
| — | twenty two players on soccer field during soccer match | 22 players on soccer field |
| — | person doing because she wants to learn something new | person wants to learn |

## Rules and boundaries

The additional deterministic pass:

1. Removes articles (`a`, `an`, `the`), `diverse`, nonessential intensifiers, `group of`, style instructions, and redundant `also`. It retains useful colors, actions, negation, quantities, and relationships.
2. Shortens repetitive constructions, such as `thinking and choosing which door to open` and repeated mentions of the same book. A small explicit phrase table handles roundabout lesson sentences. These are phrase rules, not hand-assigned image names.
3. Converts written cardinal quantities to digits. Number words in these names were identified as a separate choice because literal searches for the old word form can differ from searches for a digit.
4. Recovers natural-language text from long filenames, DALL·E prompt wrappers, and timestamped prompt exports instead of discarding that text because it is too long to adopt directly.
5. Uses an explicit noun/attribute vocabulary to recover subjects, specific objects and useful attributes from the first descriptive sentence. A separate rule retains multiple vehicle events across sentences for a shared vehicle diagram. All associated question–answer text remains available in the original audit.
6. Replaces a generic subject only where the description supports the more specific subject. It preserves singular/plural distinctions and explicit gender nouns. For example, a source describing a boy and a girl does not turn a question about `people` into a name about only the boy.
7. Upgrades compound nouns such as `ball` to `soccer ball`, instead of appending a second ball. It recognizes `plane`/`airplane`, `bike`/`bicycle`, and `tv`/`television` as equivalent when deciding whether a keyword is already present. It skips disjunctive prompt objects such as `trophy or ribbon` rather than asserting one particular object exists.
8. Adds at most one missing object phrase to an already short name, prioritizing distinctive attributes and main objects over background scenery. This keeps the additional context bounded. Numbered suffixes are recalculated from sorted exact old identifiers.

This remains a text-based proposal. A source prompt describes the intended image, and its later sentences or unrecognized nouns can still contain details this conservative pass does not recover. The full before/after file exposes every proposed conversion for review. No actual files, storage objects, or content keys are renamed.

## Reproduce

Run from `foundations/lingop`:

```sh
npm run preview:lingodex-image-names
npm run test:lingodex-image-names-preview
npm run check:lingodex-image-names-preview
```

The original map's generator and checks remain available separately. The six preview tests cover the user's examples, important simplifications, negation/relations, number formatting, source wrappers, compound nouns, singular/plural subjects, alternate prompt objects, complete coverage, uniqueness, and source-order independence.
