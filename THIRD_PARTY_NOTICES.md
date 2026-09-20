# Third-party stroke-order data

Lingop's build creates path-only, lazily loaded stroke-data buckets from the
following pinned development packages. The generated data is included in the
published package; these source packages are not runtime dependencies.

## KanjiVG

- Source used at build time: `kanjivg-js@1.1.5`, containing the KanjiVG SVG
  dataset.
- Upstream: [KanjiVG](https://github.com/KanjiVG/kanjivg), copyright Ulrich
  Apel and contributors.
- Use: primary Japanese Kanji stroke paths.
- License: Creative Commons Attribution-ShareAlike 3.0 Unported. The generated
  KanjiVG buckets are an adaptation and remain under CC BY-SA 3.0. See
  `licenses/KANJIVG-CC-BY-SA-3.0.txt`.

## AnimCJK

- Sources used at build time: `@k1low/hanzi-writer-data-jp@0.8.0` and the
  `animCJK/ZhHant` portion of `hanzi-writer-data-acjk@1.0.0`.
- Upstream: [AnimCJK](https://github.com/parsimonhi/animCJK), copyright
  2016-2026 FM&SH. The Japanese package also contains selected work from
  [subAnimJ](https://github.com/k1LoW/subAnimJ).
- Use: Japanese Kana; fallback Japanese Kanji; fallback Traditional Chinese.
- Licenses: Kanji/Hanzi graphics are under the Arphic Public License. Kana
  graphics are under GNU LGPL v3 or later. See
  `licenses/ARPHIC-PUBLIC-LICENSE.txt`, `licenses/LGPL-3.0.txt`, and
  `licenses/ANIMCJK-NOTICE.txt`.

## Make Me a Hanzi / Hanzi Writer Data

- Source used at build time: the `makemeahanzi` portion of
  `hanzi-writer-data-acjk@1.0.0`, derived from
  [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) and distributed
  in the Hanzi Writer data format.
- Copyright: Arphic Technology Co., Ltd. and Make Me a Hanzi contributors.
- Use: primary generic Traditional Chinese stroke paths.
- License: Arphic Public License. See
  `licenses/ARPHIC-PUBLIC-LICENSE.txt`.

Only path geometry needed for progressive display is copied into generated
buckets. Medians, dictionaries, source SVG metadata, and unsupported scripts
are not redistributed by lingop.

