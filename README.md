# lingop (⚠️ Internal Package Only - Not Ready for Unapproved Apps Yet)

Shared TypeScript code for Lingo projects.

This codebase is intended to be used from both web apps, such as Next.js TypeScript apps, and native apps, such as React Native TypeScript apps.

## Images

`lingop/images` provides public reads of `image_sets` and `image_files`, S3 URLs,
and admin requests to Lingoprocessor. It has no UI dependencies. The Supabase
client belongs to the consumer; credentials for S3, OpenAI and database writes
stay in Lingoprocessor.

```ts
import { createImageClient, createImageFileId, getImageFileURL, ImageRequestError } from "lingop/images";

const images = createImageClient({
  supabaseClient,
  backendTarget: "production", // existing Replit host; or "staging" / "gcloud-run"
});
const sets = await images.findWordImageSets("yue", ["貓", "狗"]);
const files = await images.getImageFiles(sets.map(set => set.id));
const urls = files.map(getImageFileURL);
const search = await images.searchImageFiles({
  artist: "Change C.C.", service: "pexels", offset: 0, limit: 50,
});
// Also available: getImageSets(ids), getImageFile(id), and literal prompt search:
// searchImageFiles({ prompt: "watercolour", imageSetId: "optional-set-id" }).
```

Word lookups use exact `{type: "word", lang, word}` reference fields, returning
all matching sets (including distinct senses). LingoDex can keep storing its
set IDs directly. Reads batch IDs/words and paginate past the database row cap.
Batch and ID reads cache for 30 seconds per client; mutations and `clearCache()`
invalidate them. Search returns `{files, count}` with explicit pagination.

```ts
const auth = { accessToken: session.access_token }; // signed-in superadmin
const setId = crypto.randomUUID();
await images.createImageSet({
  id: setId, ref: { type: "word", lang: "yue", word: "貓" },
}, auth);

// Original filename stays in metadata; original bytes go to <id>/original.ext.
await images.uploadImageFile({
  file_id: createImageFileId(), image_set_id: setId,
  file, filename: file.name, is_ai: false,
  attribution: { artist: "Change C.C.", service: "pexels" },
}, auth);

// Keep this UUID in UI state/storage BEFORE sending; reuse it for recovery.
const fileId = createImageFileId();
try {
  const generated = await images.generateImage({
    file_id: fileId, image_set_id: setId,
    attribution: { artist: "Watercolour animal illustrator" },
    prompt: "A watercolour illustration of a cat on a plain background",
    model: "gpt-image-2.5-sunburst", quality: "high",
    size: "1024x1024", output_format: "png",
  }, auth);
  console.log(getImageFileURL(generated));
} catch (error) {
  if (!(error instanceof ImageRequestError) || !error.uncertain) throw error;
  const recovery = await images.recoverImage(fileId, auth);
  // complete: use recovery.file; pending: check again after a short delay.
  // uncertain: require an explicit choice before starting a new paid generation.
  // not_found: no operation/result was found at the time of checking.
  // expired: the old ID cannot start generation; only an intentional new attempt
  // should allocate a new ID.
}
```

Uploads accept PNG, JPEG, WebP and GIF up to 10 MiB, with a matching extension.
`uploadImage` accepts raw base64 for environments without a `Blob` implementation.
Both require `is_ai` and an attribution object with a nonblank `artist`; uploads
may include existing `ai_meta`. Generated images set `is_ai: true` and attribution
`service: "openai"`. No compression or resizing occurs.

Generation is one long HTTP request. The client consumes backend keep-alive
messages and waits up to 285 seconds by default; request options also accept
`signal`, `timeoutMs`, and `backendTarget`. Aborting the client does not cancel
provider billing or guarantee the backend stopped. No automatic retry starts
another generation. Reusing a file ID with changed inputs is rejected; a new
intentional variant needs a new UUID. `recoverImage` never generates and can
finish saving metadata for an image already uploaded to S3.

Use `createImageFileId()` for upload/generation IDs (UUIDv7), not
`crypto.randomUUID()` (UUIDv4). New requests must start within 24 hours of ID
creation, allowing five minutes of future clock skew. Existing operations can
still be recovered afterwards. The timestamp remains part of the ID, preventing
expired requests from being replayed after their temporary tracking is purged.
Image-set IDs remain arbitrary nonblank strings.

S3 paths are `images/camplingo/<file_id>/original.<extension>`, with a lowercase
extension derived from `filename`. JPG, JPEG, PNG, WebP and GIF remain distinct
formats; the UUID doesn't dictate a format. `image_tmp_operations` is private
backend state, removed atomically when the final `image_files` row is saved.
The current Camp Lingo daily maintenance reconciles/purges unfinished operations
after seven days. There are no S3 request/result JSON files.

`ai_meta` preserves the prompt, requested/returned model and settings, provider
request ID, elapsed time and full raw `usage` including token breakdowns when
provided. Missing usage is `null`, not zero. Cost estimates must apply the rates
for that model/date to the individual usage categories. All image metadata is
public under the tables' read policies.

## Sign-language data

`lingop/sign-language` exposes the shared SignWords language names, available
gloss languages, and directional supplementary-lexicon relationships used by
SignWriting products:

```ts
import {
  GLOSS_LANGUAGE_NAMES,
  SIGN_LANGUAGE_GLOSS_LANGUAGES,
  SIGN_LANGUAGE_NAMES,
  SIGN_LANGUAGE_SUPPLEMENTARY_LEXICON_SOURCES,
} from "lingop/sign-language";
```

Formal SignWriting (`fsw`) remains a searchable notation rather than a gloss
language, so consumers should add it as a product-specific search option.

## Local stroke-order data

`lingop/stroke-order` exposes a unified provider for Japanese Kanji and Kana
and Traditional Chinese characters. WordDetails uses the same provider for its
progressive **Strokes** tab. All data is bundled locally in lazy code-point
buckets; there is no runtime server or network dependency.

The build-time source priority is:

- Japanese Kanji: KanjiVG, then AnimCJK.
- Japanese Kana: AnimCJK.
- Traditional Chinese: Make Me a Hanzi / Hanzi Writer Data, then AnimCJK.
- Cantonese (`yue` and `zh-HK`): the Traditional Chinese sources above, then
  a bundled CNS11643/Rime-ordered GlyphWiki/KAGE supplement for common gaps.

Run `npm run generate:stroke-data` after changing source package versions.
Maintainers can refresh the pinned Cantonese supplement with
`npm run update:stroke-data:cantonese`; this networked conversion is not part
of normal builds or runtime loading.
Generated TypeScript is intentionally ignored by Git and recreated before
build, typecheck, and test. See `THIRD_PARTY_NOTICES.md` and `licenses/` for
the required source attribution and redistribution terms.

## Shared Learning Content

Lingop is the source of truth for the static LingoDex and classic CL Learn CEFR datasets. Import the specific dataset subpath so consumers only bundle the content they need:

```ts
import { LingoDexData } from "lingop/content/lingodex";
import { cefrConcepts } from "lingop/content/cl-learn-cefr";
```

`lingop/content` also exposes the datasets as the non-colliding `lingoDex` and `clLearnCEFR` namespaces. Runtime-neutral string helpers such as `ilike` and `toCleanFilename` are available from `lingop/utils/string` without importing the broader core or UI surfaces.

## OAT: Build-Time UI Localization

OAT is separate from `LingoDataClient` and has a different lifecycle:

- **OAT is build-time plus lightweight runtime lookup.** Consumers run `oat-preflight` before development/build to scan `OAT(...)`, `OAT2(...)`, and `getStaticFocusLangAText(...)` calls and generate the application's translation and annotation assets. The React provider then loads and looks up those generated assets.
- **`LingoDataClient` is live application data.** It is a long-lived runtime/session client for live localization, annotation, Supabase, caching, and authenticated operations.

### Consumer setup

Create an `oat.config.ts` in the consumer's project root:

```ts
import { defineOATConfig } from "lingop/oat/build";

export default defineOATConfig({
  scanDirs: ["components", "pages", "contexts"],
  guiLangsByScope,
  focusLangsByScope,
  allGuiLangs,
  allFocusLangs,
  generatedAssetsRoot: "public",
});
```

OAT owns the relative `i18n/oat` and `i18n/static-a8ns` layout beneath `generatedAssetsRoot`, and uses English as its source language.

Make the override key available to the build environment, and include the compiled CLI in the consumer workflow:

```json
{
  "scripts": {
    "oat-preflight": "oat-preflight",
    "predev": "npm run oat-preflight",
    "prebuild": "npm run oat-preflight"
  }
}
```

`oat-preflight` loads the consumer's `.env`, reads `H_PERSONAL_OVERRIDE_KEY`, loads the root `oat.config.ts`, generates translations, then generates static annotations. The legacy `_H_PERSONAL_OVERRIDE_KEY` name remains supported during migration. Variables already supplied by the process environment are preserved.

OAT and Prebake use Lingop's shared backend selection. Production is the default; set `LINGOP_USE_STAGING_BACKEND=true` for both build CLIs to use Lingop's staging backend.

Lingop developers write normal `OAT("source text")`, `OAT2("source text")`, and `getStaticFocusLangAText("source text")` calls directly in shared components. Lingop's build scans those calls and generates `lingopOATSourceData`; the packaged `oat-preflight` inherently combines it with the consumer's locally scanned calls. Consumers do not maintain a separate string list or configure shared source data.

At runtime, import `OATDataProvider` and `useOAT` from `lingop/oat/react`. The provider receives `guiLang` and `focusLang` read-only plus consumer-provided `loadTranslations` and `loadStaticAnnotations` functions. Web consumers can load the generated files with `fetch`; React Native consumers can use an asset manifest or another native-compatible loader.

## Prebake: Build-Time Content Translations and Annotations

Prebake complements OAT but has a narrower job. OAT discovers literal UI calls in source code; Prebake reads the public word-list data and generates translations for word-list titles plus annotations for localized word-list words. It preserves OmniAccess's `i18n/var/translations/t.{source}-to-{target}.json` and `i18n/var/annotations/a.{lang}.json` layout.

### Build setup

Create `prebake.config.ts` in the consumer project root:

```ts
import { definePrebakeConfig } from "lingop/prebake/build";

export default definePrebakeConfig({
  generatedAssetsRoot: "public",
  translationRootListTitle: "_public",
  allLangs,
  guiLangs,
});
```

Add the CLI to predevelopment and prebuild workflows:

```json
{
  "scripts": {
    "prebake-preflight": "prebake-preflight",
    "predev": "npm run prebake-preflight",
    "prebuild": "npm run prebake-preflight"
  }
}
```

`prebake-preflight` loads the consumer's `.env`. It reads the public word-list tables directly using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`), so consumers do not construct or inject a Supabase client and no user authentication is involved. `H_PERSONAL_OVERRIDE_KEY` remains required for the backend translation and annotation generation calls; the legacy `_H_PERSONAL_OVERRIDE_KEY` name is also accepted. Variables already supplied by the process environment are preserved.

Translations fully refresh every three days. Annotations fully refresh every seven days and whenever translations receive a full refresh; otherwise both stages generate only missing values. Annotation requests retain OmniAccess's batches of ten and reset each language's backend core-word cache before generation.

Do not run annotation prebaking in `prestart`: full annotation refreshes during production server startup caused live-server crashes in OmniAccess. Keep generation in `predev` and `prebuild`.

### Runtime setup

The React provider mirrors OmniAccess's translation-only context. Browsers load generated files from `public/i18n/var/translations`. Server rendering avoids relative asset requests; consumers that need translated SSR output can pass `initialTranslationsByLangPair`.

```tsx
import { PrebakedDataProvider, usePrebaked } from "lingop/prebake/react";

<PrebakedDataProvider>
  <App />
</PrebakedDataProvider>;

function ContentLabel() {
  const { PrebakedT9n } = usePrebaked();
  const label = PrebakedT9n("Animals", "en", "es");
  // `label` is "…" while its language-pair asset loads; a missing translation
  // falls back to the source text once the asset has loaded.
}
```

## Shared Lingop client data in React

`LingopClientDataProvider` creates one `LingoDataClient` for its React subtree.
Configure the consumer's existing platform-configured Supabase client, backend
choice, and optional cloud-voice access profile once; compatible Lingop UI
components then share that configuration and the client's in-memory caches.
The consumer still owns entitlement/account policy—Lingop does not infer it
from a host or route.

```tsx
import {
  LingopClientDataProvider,
  useLingopClientData,
  useSupabaseSignedInStatus,
} from "lingop/react";

<LingopClientDataProvider
  supabaseClient={supabaseClient}
  useStagingBackend={process.env.NODE_ENV === "development"}
  apiVoiceAccessProfile="ONE_PER_LANG"
>
  <App />
</LingopClientDataProvider>;

function Example() {
  const { lingopClient } = useLingopClientData();
  const { signedInStatus, userEmail, enabledSubProd } = useSupabaseSignedInStatus();
  // The same client and account state are available to web and native components.
}
```

`WordListsSelector`, `WordListVisualLeafNode`, `AnnotatedTextView`, `CampLingoAuthForm`, `UserWordStreaksDataProvider`, and `useSupabaseSignedInStatus()` use the provider when present. Their explicit Supabase-client inputs remain temporarily available for migration or intentional overrides. Non-React APIs, including `speechSynthTTS`, cannot read React context and retain explicit client options.

`lingop/react` works with Next.js and React Native and imports no UI renderer,
CSS, browser speech, or Expo modules. Its `"use client"` directive preserves the
Next.js client boundary; native React can use the same exports. Existing
`lingop/ui/next` provider and account-hook imports remain compatibility exports
of this implementation, so mixing the two paths does not create separate contexts.
The client remains stable when only `apiVoiceAccessProfile` changes; replacing
the Supabase client or backend environment creates a new client and caches.

The host creates its Supabase client and owns platform-specific auth persistence,
auto-refresh lifecycle, and sign-in redirects. Pass that client to the provider
on either platform. No browser globals or native storage modules are configured
by this entry point. Native Lingop views that accept `lingopClient` as a prop can
receive it from `useLingopClientData()`; their existing prop APIs are unchanged.
`useSupabaseSignedInStatus()` uses the provider by default, accepts an explicit
Supabase client for standalone auth state, and accepts `null` to disable auth.
Its subscription fields use the provider's client only when no override is passed.

## Shared user language-display preferences

`UserLingoPrefsDataProvider` persists the browser user's spelling, main-text,
gloss, reading-guide, and non-core display preferences. It must be rendered
within `OATDataProvider` because its spelling-system labels are localized.
Consumers retain ownership of route/site defaults and pass only the resolved
defaults plus the optional current focus language:

```tsx
import {
  UserLingoPrefsDataProvider,
  type UserLingoPrefsDefaults,
} from "lingop/ui/next";

const defaultPrefs: Partial<UserLingoPrefsDefaults> = {
  prefShowGlossEmoji: "NEVER",
  prefShowGlossText: "ON_HINT",
};

<UserLingoPrefsDataProvider
  defaultPrefs={defaultPrefs}
  focusLang={focusLang}
>
  <App />
</UserLingoPrefsDataProvider>;
```

`AnnotatedTextView` uses these preferences when the provider is present.
Explicit `showSpelling`, `showMainText`, `showGlossText`, `showGlossEmoji`,
`showLocalMainTextReadingGuide`, and `localShouldFadeNonCoreWords` props take
precedence for an individual view.
Without the provider, its existing standalone defaults remain unchanged.

The corresponding shared phonetic-part formatter can be used by Lingop or
consumer-owned annotated-text views:

```ts
import {
  getSpellingContent,
  SpellingSystem,
} from "lingop/core/language";

const spelling = await getSpellingContent(
  "en",
  ["cat", "K AE1 T"],
  SpellingSystem.EN_IPA,
  true,
);
// "ˈkæt"
```

`getMainScriptReadingGuidePart(lang, text)` provides the same locally generated
Sinhala, Greek, Korean, Thai, Egyptian Arabic, and Toki Pona reading guides used
by `AnnotatedTextView` when backend phonetics are unavailable.

`getMainScriptReadingGuideToken(lang, text)` returns those guides in the full
`PhoneticToken` shape consumed by annotated-text renderers. Korean readings are
aligned per grapheme (for example, `선생님` becomes `선/seon`, `생/saeng`,
`님/nim`); the other local guides remain a single whole-token part.

Korean local guides use lazily loaded `koroman@1.0.16`. The entire Hangul token
is converted before splitting its pronunciation into syllables, preserving
contextual changes: `국물` → `국/gung`, `물/mul`; `같이` → `같/ga`, `이/chi`.
These are Koroman romanizations, not exhaustive phonetic transcriptions.
NFC normalization and edge `‿` markers are preserved. Mixed-script tokens or
unrecognized intermediate structures receive a whole-token guide instead of
speculative alignment. Joined syllable guides must equal the full conversion.
The version is pinned because alignment uses Koroman's intermediate jamo
representation; upgrade it together with the Korean alignment regression tests.
Mutable custom dictionaries are disabled to keep the local output deterministic.
Backend-provided phonetics still take precedence over these local fallbacks.

## Camp Lingo Auth Form in Next.js

`CampLingoAuthForm` is the shared Camp Lingo browser login/signup UI. It owns the common Camp Lingo branding and labels, email/password flows, Google Identity Services integration, and forgot-password destination. It uses basic DOM elements and stable class names so consumers can override its appearance without taking on a UI-framework dependency.

The form uses the browser-configured Supabase client from `LingopClientDataProvider`; the consumer supplies its current GUI language. Lingop does not create or configure Supabase itself, and the form is currently part of `lingop/ui/next`, not the React Native UI.

```tsx
import {
  CampLingoAuthForm,
  CampLingoAuthFormMode,
} from "lingop/ui/next";
import "lingop/ui/next/camp-lingo-auth-form.css";

<CampLingoAuthForm
  guiLang={guiLang}
  initialMode={CampLingoAuthFormMode.LOG_IN}
  onSuccessfulAuth={(mode) => handleSuccessfulAuth(mode)}
/>;
```

The stylesheet provides the default Camp Lingo appearance. Consumers can override the `lingop-camp-lingo-auth-form*` classes or pass an additional root `className`.

## Word-list selector in Next.js

`WordListsSelector` and its `WordListVisualLeafNode` use plain React and CSS, with no Chakra UI or other visual-framework dependency. They use `LingopClientDataProvider` together with the existing Prebake and user-word-streak providers; the consumer supplies the current language pair.

```tsx
import { WordListsSelector } from "lingop/ui/next";
import "lingop/ui/next/word-lists-selector.css";

<WordListsSelector
  guiLang={guiLang}
  focusLang={focusLang}
  rootListPk="_public"
  mode="EXPLORE"
  onSelectedWordListPks={(listPks) => openSession(listPks[0])}
  showWordStreaks
/>;
```

## Word-list view in Next.js

`WordListView` recursively renders one localized word-list tree. By default,
terminal lists use Lingop's `WordChipsArrayView`; one word-details popover is
shared across the full tree. `LingopClientDataProvider` and
`PrebakedDataProvider` are required. `UserWordStreaksDataProvider` is optional
unless `showWordStreaks` is enabled.

```tsx
import { WordListView } from "lingop/ui/next";
import "lingop/ui/next/word-list-view.css";

<WordListView
  rootListPk="_public"
  guiLang={guiLang}
  focusLang={focusLang}
  showWordStreaks
/>;
```

Site-specific terminal cards can remain consumer-owned through `renderLeaf`:

```tsx
<WordListView
  rootListPk={wordListPk}
  guiLang={guiLang}
  focusLang={focusLang}
  renderLeaf={({ words, listPk }) => (
    <MyWordCardGrid words={words} wordListPk={listPk} />
  )}
/>;
```

The aggregate stylesheet includes the default word-chip and word-details
styles. Consumers can override the isolated `lingop-word-list-view*` classes.

## Install

Use the prebuilt package attached to a [GitHub Release](https://github.com/fullcells/lingop/releases).
For the first install or migration from a Git dependency:

```sh
npm install https://github.com/fullcells/lingop/releases/download/v0.7.953/lingop-0.7.953.tgz
```

Replace both version numbers when selecting a different release. These are public
downloads; consumers do not need a GitHub account, token, or registry configuration.
The archive includes compiled JavaScript, declarations, fonts, and stroke data.
It does not compile lingop or install its build-time dependencies on the consumer.

Add this to the consumer's existing `package.json` scripts:

```json
"update:lingop": "lingop-update"
```

```sh
npm run update:lingop                 # Latest stable GitHub Release
npm run update:lingop -- --check       # Show latest release without changing files
npm run update:lingop -- 0.7.953       # Select a specific version, including rollback
```

The updater ships inside lingop and updates along with it. Run it from the
consumer's package directory. It preserves whether lingop is a production,
development, or optional dependency and saves a version-specific archive URL.
Commit `package.json` and `package-lock.json` together. Regular installs and
deployments continue to use `npm ci`; do not run the updater automatically during
builds. `npm update lingop` does not discover new versions of an archive URL.
Release discovery uses GitHub's anonymous API (60 requests/hour per public IP);
normal installs of an already pinned URL do not perform this lookup.

Migration is per consumer: existing `github:fullcells/lingop` dependencies and
their source-build `prepare` hook remain supported. Imports do not change.

## Release a New Version

1. Update the version in `package.json` and `package-lock.json` (for example,
   `npm version patch --no-git-tag-version --ignore-scripts`).
2. Commit and push the source changes, then push a matching `vX.Y.Z` tag.
3. The **Release prebuilt lingop** GitHub Actions workflow builds, tests, packages,
   verifies a clean installation, and publishes `lingop-X.Y.Z.tgz` on the release.

For example, after committing and pushing version `0.7.953`:

```sh
git tag -a v0.7.953 -m "Release v0.7.953"
git push origin v0.7.953
```

The workflow can also be run manually against an existing version tag. GitHub
provides its publishing token automatically; no personal token or npm registry
account is required. A version is available to archive consumers only after the
workflow succeeds. Do not delete old release assets or replace a published
version: pinned consumer builds depend on those exact archives. Publish a new
version for fixes. The workflow deliberately fails if the release already exists.

Local release checks:

```sh
npm run test:release
npm run release:pack
npm run release:smoke
```

`release:pack` builds once and creates the archive under ignored `releases/`.
Only the archive's manifest omits build scripts and development dependencies;
the source manifest retains them for Git consumers. GitHub's automatic source
ZIP/tar downloads are not substitutes for the prebuilt `.tgz` asset.

## Lingo Data Usage

For localization, translation, annotation, word-explicitation, emoji, and SBWords workflows, prefer `createLingoDataClient()` from `lingop/core`.

The client owns its in-memory annotation and translation caches. Runtime-specific dependencies, such as Supabase setup and token access, are dependency-injected by the app.

Create one long-lived `LingoDataClient` per user-facing runtime/session and reuse it across pages, routes, or screens.

Low-level annotation API calls, `callAnnotate_storedForOwner()` remains public and calls backend `/api/annotate`.

## `LingoDataClient` Public API

`createLingoDataClient()` returns a long-lived client instance with these callable methods:

- `supabaseUserID`, `userEmail`, `signedInStatus`, and `enabledSubProd`: current Supabase auth/subscription state derived from the injected Supabase client. `signedInStatus` starts as `null` while auth is loading; `enabledSubProd` starts as `undefined` until the first `users_info.enabled_sub_prod` lookup completes.
- `refreshEnabledSubProd()`: reloads `users_info.enabled_sub_prod` for the current Supabase user and updates `enabledSubProd`.
- `fetchLocalization({ l10n_lang, sourceContent, isPublic? })`: returns the newest localization for a source-content record, using the client cache first and generating/fetching as needed.
- `createTransientTranslation({ sourceLang, sourceText, targetLang })`: creates and session-caches a reference-less Oral-to-Oral translation through the limited-anonymous backend.
- `createOralToSignedTranslation({ sourceLang, sourceText, targetLang })`: creates and session-caches an ordered SignWord/fingerspelling translation. Its rich response preserves related-Sign-Language provenance and warnings.
- `createSignedToOralTranslation({ sourceLang, sourceSignWordIds, targetLang })`: creates and session-caches natural Oral Language text from an ordered SignWord ID sequence.
- `updateTranslationsCaches(rows)`: merges translation rows into the owned translation cache and keeps the newest entries first.
- `getT9nCacheDateBySC(sourceContent)`: reads the last cache timestamp tracked for a source-content record.
- `_updateT9nCacheDatesBySCs(sourceContents)`: updates cache timestamps for one or more source-content records.
- `retranslate({ id })`: loads the existing translation row, generates fresh text through backend `/api/translate-create-limited-anon`, updates that Supabase row's `target_text`, `created_at`, and backend-reported `translator`, then refreshes the client cache.
- `updateTranslationWithHumanEdit({ id, targetText })`: updates an existing Supabase translation row's `target_text`, `created_at`, and `translator: "USER"`, then refreshes the client cache.
- `fetchAnnotation({ localization })`: returns annotation data for a localization, using cache/Supabase/backend lookup as needed.
- `createTransientAnnotation({ lang, text })`: creates a reference-less annotation through the limited-anonymous backend, forwarding the current session token when available and reusing the result for the lifetime of the client.
- `reGenOwnerAnnotation({ localization, skipDeletionOfExisting? })`: deletes and rebuilds an owner-scoped annotation, then refreshes the annotation cache.
- `reAnnotateWithExistingData(input)`: re-runs backend annotation generation from existing stored annotation data and updates the annotation cache with the returned rows.
- `loadWordExplicitationsRows()`: loads and caches Supabase `word_explicitations` rows.
- `getOneWayWordExplicitations({ source_lang, source_word, target_lang })`: filters the cached word-explicitation rows into the legacy one-way shape.
- `loadWordLists()`, `loadWordListMetaData()`, and `loadSBCacheWordListsForLang(lang)`: load and cache public word-list source and localization rows. They use the injected Supabase client but do not inspect or require an authenticated user.
- `loadWordListMetaDataV3()`, `loadWordListsV3(lang)`, `getWordListL10nV3(listId, lang)`, and `getDescendantL10nsOfWordListsV3(listIds, lang)`: read exclusively from `word_lists_v3`, `word_list_words`, and `word_list_sublists`. These functions have no dependency on `word_lists` or `cache_word_list_l10n_words` and will continue working when those legacy tables are removed. See the v3 migration example below.
- `clearWordListsV3Cache()`: invalidate this Supabase client's v3 catalog and language data after editing lists, words, or sublist relationships.
- `loadWordScoreKeys()`, `getWordScores(words, lang, scoreKeyId)`, and `clearWordScoresCache()`: load scoring methods and batched, cached word scores. Use the standalone `sortWordsByScore()` helper to order and display scored words. See the scoring example below.
- `preloadEmojiData()`, `loadEmojiData()`, `generateEmoji(en_gloss, study_word?, study_lang?)`, and `generateEmojis(en_glosses)`: warm Lingop's persistent browser cache, load shared Supabase emoji rows, and generate emoji text for English glosses. `preloadEmojiData()` also warms the small non-core-word dataset used to resolve compound or non-exact glosses. `generateEmojis()` deduplicates a view's glosses, initiates that preload itself, and resolves all results as one keyed batch. Cached emoji rows survive page reloads and browser restarts; stale data is served immediately while Lingop checks the row count and newest `created_at` value in the background. When editing an existing emoji row, advance its `created_at` value so clients detect the revision.
- `isNotCoreWord(word_lang, word, gloss?)`, `getSBWordsForLangDir(word_lang, gloss_lang)`, `refreshCoreSBWordsCache(word_lang, gloss_lang)`, and `fetchAndGenGloss({ source_lang, source_word, target_lang })`: use the shared SBWords cache for core-word checks and one-word gloss generation.
- `getHancharDecomposition(literal)`: returns one Unicode character's canonical component tree and available Japanese, Cantonese, and Mandarin readings from the public Han-character dataset. Repeated successful lookups are cached by the client instance.
- `createWordExposureRow(...)`, `addWORDExposureNow(...)`, `getWORDExposureRow(...)`, and `deleteWORDExposureRow(...)`: manage the authenticated user's per-word exposure rows through the Supabase client already owned by `LingoDataClient`.

Additional core helpers:

- `getBinderDoc({ supabaseClient, id })`: fetches one `user_binder_docs` row by its primary-key ID.
- `annotateBinderMarkdownLines({ lines, binder, doc, fetchAnnotation, ... })`: annotates every non-markdown, non-empty segment while preserving the source line/segment shape and stable binder-document reference coordinates. It supports source documents directly and localized documents through `localization`, `l10nLang`, and optional `translationId`; pass the long-lived client's `fetchAnnotation` method as the callback.
- `getBinderDocsByMinL10nsOrder([{ doc_id, l10ns }], priorityDocIds?)`: recommends a learning order for already-loaded binder doc localization caches. It normally minimizes new words, with one narrow recurring-word exception for vocabularies above 1,000 unique l10ns. Omitted priorities default to doc `179` (for LingoTrivia); pass `[]` to disable defaults.
- `fetchBinderDocsByMinL10nsOrder({ supabaseClient, binder_id, lang, priorityDocIds? })`: loads `cache_binder_doc_l10ns` rows for a binder/language pair and returns the same recommended ordering.
- Low-level `loadWordExplicitationsRows({ supabaseClient })` and `getOneWayWordExplicitations(input, { supabaseClient })` remain exported for gradual migration, but app code should prefer the existing `LingoDataClient`.

### Word lists v3: gradual migration

The v3 readers use only `word_lists_v3`, `word_list_words`, and `word_list_sublists`.
They do not query or fall back to `word_lists` or `cache_word_list_l10n_words`.
The legacy and v3 APIs coexist as separate read paths during migration.
Existing word-list methods, `WordListView`, `WordListsSelector`, and Prebake keep
their legacy behavior. Consumers opt into v3 explicitly; these readers neither
update tables nor generate translations.

```ts
import { createLingoDataClient, buildWordListTreeV3 } from "lingop/core";

const lingoData = createLingoDataClient({ supabaseClient });
const catalog = await lingoData.loadWordListMetaDataV3(); // All languages; no words.
const japaneseLists = await lingoData.loadWordListsV3("ja");

async function readSelection(selectedListId: number, focusLang: string) {
  // The selected ID can belong to any language in the family.
  const localized = await lingoData.getWordListL10nV3(selectedListId, focusLang);
  if (!localized) return null; // No counterpart in this language.

  const lists = await lingoData.loadWordListsV3(focusLang);
  return {
    title: localized.title,
    ownWords: localized.words.map((word) => word.text),
    tree: buildWordListTreeV3(lists, localized.id),
    allWords: await lingoData.getDescendantL10nsOfWordListsV3(
      [selectedListId], focusLang,
    ),
  };
}

// After an authorized editor saves any of the three tables:
lingoData.clearWordListsV3Cache();
// Alternatively, invalidate and read immediately:
await lingoData.loadWordListsV3("ja", { forceRefresh: true });
```

- **Identity and families:** store numeric v3 IDs in consumer selections. Legacy
  title keys are not v3 IDs, and localized titles may differ. `anchor_list_id ?? id`
  identifies a direct family; the anchor can be in any language. Roots have a null
  anchor and members point directly to the root. `resolveWordListL10nV3(catalog,
  id, lang)` is also available for synchronous metadata lookup. Missing lists or
  languages return null. Multiple possible counterparts throw rather than choose
  arbitrarily; an explicitly selected list already in the requested language is
  returned as-is. IDs outside JavaScript's safe integer range are rejected.
- **Content and ordering:** `loadWordListsV3(lang)` returns metadata plus `words`
  (full word rows) and `sublists` (full edge rows). Words follow ascending position;
  null positions come last, ordered by word ID. Duplicate wording is retained.
  Child edges follow their own positions, including gaps. Each language owns its
  wording, word count, ordering, title, and child relationships. Stored wording
  already incorporates the migrated explicitations and is used unchanged.
- **Traversal:** `getDescendantL10nsOfWordListsV3` resolves selected IDs to the
  requested language and walks that language's hierarchy, taking parent words
  before child words and returning exact-text-unique strings. Shared descendants
  are visited once. Cross-language child edges resolve within the child's family;
  missing counterparts are skipped without falling back to English.
  `buildWordListTreeV3` instead follows exact stored IDs among the lists supplied
  to it, allowing shared nodes in separate branches and omitting unavailable
  children. Both skip cycles by default; pass `{ throwOnCycle: true }` to reject
  them. The tree helper expects the ordered lists returned by the loader.
- **Efficiency and freshness:** catalog and per-language reads share in-flight
  requests and cache successful results for five minutes, scoped to the injected
  Supabase client instance. Reuse that instance. Words and edges load concurrently
  in batches of up to 250 list IDs, with stable pagination and exact counts to
  respect server row limits. There is no per-list network request or additional
  database cache table. Warm reads make no network requests. Failed or malformed
  reads reject and remain retryable; returned arrays are copies so consumer edits
  cannot corrupt the cache. Pass `{ maxAgeMs: 0 }` to bypass completed cached
  reads, or another non-negative duration to customize freshness. A forced refresh
  invalidates all v3 entries for that Supabase instance; an older in-flight read
  cannot repopulate the new cache. Reads of the three tables are separate requests,
  not a transactional snapshot. Editor writes should complete before refreshing.

The same v3 read functions are exported directly from `lingop/core` and accept
`{ supabaseClient, forceRefresh?, maxAgeMs? }` as their last argument. The standalone
`clearWordListsV3Cache(supabaseClient?)` clears one client's v3 cache, or all v3
caches when omitted. A configured Supabase client is required; no authenticated
user is required for these public tables. V3 cache invalidation is independent of
the legacy `clearWordListsCache()`.

### Word scores and list ordering

Scoring reads use `word_score_keys` (`id,title,sort_direction,updated_at`) and
`word_scores` (`lang,word,score_key_id,value`). Words match **exactly by language
and text**, including any stored explicitation markers. These APIs do not generate
scores, normalize spelling, translate words, or change saved list positions.

```ts
import { createLingoDataClient, sortWordsByScore } from "lingop/core";

const lingoData = createLingoDataClient({ supabaseClient }); // Reuse your existing client.
const methods = await lingoData.loadWordScoreKeys(); // Populate the score-method picker.
const method = methods.find(row => row.id === selectedScoreKeyId);
if (!method) throw new Error("Choose an available scoring method.");

const words = await lingoData.getDescendantL10nsOfWordListsV3(
  selectedListIds, focusLang, { throwOnCycle: true },
);
const scores = await lingoData.getWordScores(words, focusLang, method.id);
const ordered = sortWordsByScore(words, scores, method.sort_direction);
// [{ word: "公仔麵", value: 1 }, ..., { word: "an unscored word", value: null }]
// Display each value as its source score; it is not a newly assigned rank in this list.

// After an editor finishes writing scores or changing a method's title/direction:
lingoData.clearWordScoresCache();
```

- `loadWordScoreKeys(options?)` returns copied metadata ordered by stable numeric
  ID. Store the ID in selections; titles are editable.
- `getWordScores(words, lang, scoreKeyId, options?)` returns a new
  `Map<string, number | null>` in first-input order. Duplicate input words are
  looked up once. A missing row is `null`; zero, negative, and fractional scores
  retain their numeric values. Choose a valid key from `loadWordScoreKeys`:
  an unknown key has no matching scores and therefore returns nulls.
- `sortWordsByScore(words, scores, direction)` is synchronous and does not mutate
  its inputs. It returns `{ word, value }[]`, keeps duplicates if supplied, puts
  missing scores last in either direction, and preserves input order for ties.
  Re-sorting the same loaded scores makes no network requests.
- All read APIs are also standalone exports from `lingop/core`, accepting
  `{ supabaseClient, maxAgeMs?, forceRefresh? }` as their final argument. The shared
  client methods accept the same options without `supabaseClient`.

**Large lists and frequent reads:** lookups fetch only the requested words for one
language/key, rather than downloading an entire corpus or requesting each word
separately. IN filters contain at most 100 words and roughly 3,000 encoded
characters, with four active score batches per Supabase client. Very long
individual entries that exceed this filter budget reject explicitly. Queries are
ordered and paginated, including when the server's row cap is smaller than the
requested page. Text literals are escaped for PostgREST filters.

Successful scores and confirmed missing rows are cached individually for five
minutes, so overlapping lists reuse them. Identical pending lookups share work.
The cache retains at most 20,000 word/language/key entries per Supabase client,
evicting least recently used entries; larger reads still return all requested
results. Scoring-method metadata has the same default TTL. Returned Maps and
metadata can be edited without corrupting the cache. Failures reject and remain
retryable; a failed batch never becomes a set of cached "missing" values.

Use `{ maxAgeMs: 0 }` to bypass settled values, or another finite non-negative TTL.
`{ forceRefresh: true }` or `clearWordScoresCache()` invalidates both scoring
caches for that Supabase instance; older pending reads cannot refill the new
cache. The standalone `clearWordScoresCache(supabaseClient?)` can clear one client
or all clients. List caches are separate. Reads across batches are not a
transactional snapshot, so finish imports before refreshing consumers. The
key's `updated_at` is metadata, not automatic score-change detection: score rows
have no timestamp and may change without the key changing.

Caches are **in memory**, shared only by calls using the same Supabase instance.
They do not survive a full browser reload or automatically share across visitors,
server processes, or devices. Public pages with substantial repeated traffic
should cache their public list/score response in the consumer's server/CDN with
an appropriate expiry or invalidation policy. This layer does not introduce a
database cache table, framework-specific caching, or persistent browser storage.
The current `(lang, word, score_key_id)` primary key supports these exact lookups.

Scores are JavaScript numbers: finite values are required and unsafe integers
reject. Normal floating-point precision applies to fractions; arbitrary-precision
Postgres numeric calculations are not provided by these APIs.

The client also exposes two owned cache references for advanced callers:

- `translationsCache.current`: in-memory `TranslationRow[]` cache owned by the client instance.
- `annotationsByLangNTextCache.current`: in-memory annotation cache owned by the client instance.

## Lingo Data Example

```ts
import { createLingoDataClient } from "lingop/core";

const lingoData = createLingoDataClient({
  supabaseClient,
  useStagingBackend: false,
});

const localization = await lingoData.fetchLocalization({
  l10n_lang: "th",
  sourceContent,
});

const annotation = await lingoData.fetchAnnotation({ localization });
```

## User Word Streaks in React and React Native

`UserWordStreaksDataProvider`, `useUserWordStreaksData`, and
`useOptionalUserWordStreaksData` are available from `lingop/react`. They share
one context with the existing Next and native entry points. Place the provider
beneath `LingopClientDataProvider`, or pass `supabaseClient` explicitly (`null`
selects anonymous storage). Mutations reject while account loading is pending; wait for auth to be ready.

For Next.js, existing imports and props continue working. The Next wrapper
supplies localStorage and browser visibility/online events:

```tsx
import { UserWordStreaksDataProvider } from "lingop/ui/next";

<UserWordStreaksDataProvider focusLang={focusLang}>
  <App />
</UserWordStreaksDataProvider>;
```

For native apps, supply an asynchronous storage implementation and AppState.
These modules are owned by the host; Lingop adds no Expo or AsyncStorage dependency.
The narrow native subpath avoids loading the native UI and stroke datasets:

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import {
  UserWordStreaksDataProvider,
  createNativeWordStreaksLifecycle,
} from "lingop/ui/react-native/user-word-streaks";

// Keep adapters stable across renders.
const streakLifecycle = createNativeWordStreaksLifecycle(AppState);

<UserWordStreaksDataProvider
  focusLang={focusLang}
  storage={AsyncStorage}
  lifecycle={streakLifecycle}
>
  <App />
</UserWordStreaksDataProvider>;
```

`WordStreaksStorage` needs asynchronous `getItem`, `setItem`, and `removeItem`
methods; replacing a key must be atomic. `WordStreaksLifecycle` supplies
`subscribe(listener)` returning an unsubscribe function. Both foreground and
background events attempt sync for every loaded language. Native apps can also
call `syncUserWordStreaks(lang)` when network connectivity returns.

```tsx
import { useUserWordStreaksData } from "lingop/react";

const streaks = useUserWordStreaksData();
await streaks.ensureUserWordStreaksForLang("es");
await streaks.setUserWordStreaksToValue("es", ["hola"], 1);
await streaks.setUserWordStreaksByDelta("es", [{ word: "hola", streakDelta: 1 }]);
await streaks.setUserWordStreaksToMin1("es", ["adios"]);
await streaks.deleteUserWordStreaks("es", ["hola"]);
// Pass streaks directly as wordStreaksData to native word chips/details.
```

Mutations (including `deleteAllUserWordStreaksForLang`) return promises that
resolve only after the local save succeeds. Storage errors reject the operation
and are exposed as `streaks.error`; the provider also accepts `onError`.
Signed-in accounts keep a durable local snapshot and pending word changes.
A failed network request keeps those changes queued; retries occur after
`syncDelayMs` (default 30 seconds), on lifecycle events, and after restart.
The current language may be null: existing pending changes still resume, and
explicit ensure/mutation calls can load other languages. Await ensure before
performing changes that depend on the latest counts; a failed refresh retains
the local snapshot and reports an error.

Caches are isolated by account and `storageNamespace` (the Supabase URL by
default). Supply a namespace when a custom client does not expose its URL, or
when multiple apps sharing storage require separate data. Keep one provider per
account/storage scope. Existing anonymous `USER_VOCAB_STREAKS_<lang>` keys are
read as a fallback. On the first successful server read for an account/language,
guest words are adopted only if the server is empty; the pending account copy
is saved locally before the guest copy is removed.

Sync applies changed words to a freshly read server map and conditionally writes
only if `updated_at` still matches. Conflicts retry without discarding unrelated
words from another device. Failed reads never become empty server snapshots.
Concurrent edits to the same word use the last successful pending value;
deltas are local count changes, not distributed additive counters. Reset-all
intentionally clears the whole language. These conflict protections apply to
consumers using this provider; older clients that upload whole maps can still
overwrite data. The existing table/RLS is used without a schema migration.
A background sync remains best effort; restart recovery relies on the completed
local save, not on iOS granting time to finish a network request.

## User Word Exposures

Word exposures complement word streaks with per-word encounter counts and recent
timestamps. Exposure methods are
also platform-neutral and available on the long-lived `LingoDataClient`. Supply the
Supabase client once when creating `lingoData`, then reuse that client instance.

```ts
import { createLingoDataClient } from "lingop/core";

const lingoData = createLingoDataClient({ supabaseClient });

const created = await lingoData.createWordExposureRow({
  word_lang: "en",
  word: "Obama",
  user_gloss_lang: "yue",
  user_gloss: "奧巴馬",
  position: "Biography, opening paragraph",
});

const updated = await lingoData.addWORDExposureNow({
  word_lang: "en",
  word: "OBAMA",
  user_gloss_lang: "yue",
});

const exposure = await lingoData.getWORDExposureRow({
  word_lang: "en",
  word: "obama",
});

const deleted = await lingoData.deleteWORDExposureRow({
  word_lang: "en",
  word: "oBaMa",
  user_gloss_lang: "yue",
});
```

The methods use the Supabase client and authenticated user already managed by
`lingoData`.

- `createWordExposureRow(...)` preserves the original casing supplied in
  `word`. It returns the created row, or `null` when creation fails, including
  when another row under the same user, word language, and gloss language
  already has a case-insensitive word match. Its optional `position` is a
  user-supplied note describing where the word appeared and is stored as
  `null` when omitted.
- `addWORDExposureNow(...)` finds the row case-insensitively, increments
  `exposures`, prepends the current timestamp to `recent_exposures`, and returns
  the updated row. It returns `null` if the row does not exist or cannot be
  updated. `recent_exposures` is always newest-first and limited to 10 entries.
- `getWORDExposureRow(...)` finds a word case-insensitively and returns its row,
  or `null` when none exists. Because this read intentionally does not take
  `user_gloss_lang`, if several gloss-language variants exist it returns the
  most recently created matching row.
- `deleteWORDExposureRow(...)` deletes the case-insensitive match for the full
  user, gloss-language, word-language, and word key. It returns `true` when a
  row was deleted and `false` otherwise.

The database identity includes `user_gloss_lang`, so consumers must pass it
when creating, incrementing, or deleting an exposure. Casing is presentation
data: for example, `Obama` remains stored as `Obama`, while later calls using
`OBAMA` or `obama` match the same row.

## Localization Docs & Segments

`Localization` represents a full localized document/translation/string. To annotate only part of it, use the same `Localization` shape and store segment coordinates on the DB ref:

```ts
{ db: { table: "translations", column: "target_text", id: 7, line_idx: 4, seg_idx: 1 } }
```

`line_idx` and `seg_idx` are optional and identify a `LocalizationSegment` within the larger document. Annotation helpers preserve them when creating the stored annotation ref. Omit `line_idx` and `seg_idx` when annotating the whole localization.

## Rendering Annotation in React Native (iOS and Android)

`lingop/ui/react-native` exports a native `AnnotatedTextView` using React Native
`View`, `Text`, `Pressable`, and `ActivityIndicator`. It accepts the same
`AnnotatedText` data as the web renderer and does not import the Next.js UI,
CSS, DOM, browser speech, or web data providers. Use it inside a bounded-width
native view so token groups can wrap.

The app supplies React and React Native (supported peer range: React Native
0.81+; development type checks use 0.83). React Native and React DOM are optional
peers, so consumers only need the renderer used by their app. No Expo-specific
dependencies or CSS imports are required for annotated text. The word-detail
stroke diagrams additionally use the optional `react-native-svg` peer.

```tsx
import { useState } from "react";
import { View } from "react-native";
import type { AnnotatedText } from "lingop/annotation";
import { AnnotatedTextView } from "lingop/ui/react-native";

const sentence: AnnotatedText = {
  lang: "ja",
  lang_text: "猫。",
  tokens: [
    { text: "猫", isWord: 1, gloss: "cat", phoneticToken: [["猫", "ねこ"]] },
    { text: "。", isWord: 0 },
  ],
  containsGloss: true,
  containsPhonetics: true,
  ref: null,
  owner_id: null,
};

export function ReadingExample({ lingopClient }: { lingopClient: import("lingop/core").LingoDataClient }) {
  const [hintedIndex, setHintedIndex] = useState<number | null>(null);
  return (
    <View style={{ padding: 16 }}>
      <AnnotatedTextView
        annotatedText={sentence}
        showSpelling="ALWAYS"
        showGlossText="ON_HINT"
        showGlossEmoji="ON_HINT"
        isTokenHinted={({ index }) => index === hintedIndex}
        lingopClient={lingopClient}
        onTokenPress={({ index }) => setHintedIndex(index)}
        tokenAccessibilityHint="Show a word hint"
        astyle={{ mainTextSize: 24, spellingSize: 14, glossPlacement: "bottom" }}
      />
    </View>
  );
}
```

Pass a stable `createLingoDataClient({ supabaseClient })` instance from `lingop/core`
through `lingopClient` to use the same cached `generateEmojis` batch pipeline as the
web renderer. Only visible emoji glosses are requested, duplicates are removed,
and stale responses cannot overwrite another annotation or client's results.
`onEmojiLoadStateChange` reports pending work. While resolving, an inline spinner
occupies the emoji slot; missing/failed results fall back to the English gloss,
as on web. Without a client, the English fallback is shown immediately.
`getTokenEmoji` remains an optional synchronous override that bypasses the client.
All tokens reserve matching emoji/text slots, including punctuation, unhinted
words and missing annotations, for every gloss placement and row order.

This initial native surface supports:

- Per-part spelling/furigana, main text, text glosses, and shared Lingop emoji resolution.
  Defaults match standalone web display preferences: spelling and text glosses
  `ALWAYS`, main text enabled, and emoji `ON_HINT`.
- `NEVER`, `ON_HINT`, and `ALWAYS` display controls. `ON_HINT` depends solely on
  `isTokenHinted`; without that callback, hints remain hidden. Word taps and long
  presses call `onTokenPress`/`onTokenLongPress`. Callbacks receive the original
  annotation, display token, linearized token index, and source morphemes.
- Punctuation grouping, explicit line breaks (including blank lines), Japanese
  duplicate-reading suppression, disambiguator removal, and root/pattern
  linearization. Wrapping happens between token groups; words and their attached
  punctuation remain together, so exceptionally wide groups can overflow.
- Language-derived LTR/RTL layout, with a `textDirection` override. Gloss text
  defaults to LTR; override `glossTextStyle.writingDirection` for an RTL gloss.
- `astyle` sizes, colors, word/line spacing, spelling above/below, and gloss on
  any side. Dimensions are native layout units. `mainTextStyle`, `spellingStyle`,
  `glossTextStyle`, and `glossEmojiStyle` accept native `StyleProp<TextStyle>`
  overrides, including app-registered fonts. The outer `style` and other native
  `ViewProps` (such as `testID`, accessibility props, and `onLayout`) are forwarded.
- Accessible word controls, font scaling enabled by default (configurable with
  `allowFontScaling`/`maxFontSizeMultiplier`), and an accessible loading indicator
  for `annotatedText={null}` with a customizable `loadingLabel`.

This is a rendering foundation, not full web API parity. The app currently owns
annotation fetching, client configuration, local reading-guide/spelling conversion,
translated glosses and learning preferences/streaks. Optional native word details
and shared speech controls are described below. Browser actions, CSS-specific styling, monochrome emoji font
handling, and image/HTML/ref exports are not part of this native API. Custom fonts
must be registered by the host app; the web stylesheet's fonts are not loaded
automatically. Native tests cover component structure and callbacks with mocked
primitives; device font metrics, wrapping, and VoiceOver/TalkBack require app QA.

## Native word chips and word details

`lingop/ui/react-native` also exports `WordChipsArrayView`,
`L10nWordDetailContent`, `L10nWordDetailModal`, and `useL10nWordDetailModal`.
They use native views and one scrollable modal per chip array, with close,
backdrop, accessibility escape, and Android Back dismissal. Pass the same stable
`createLingoDataClient({ supabaseClient })` instance used by annotations.

```tsx
import {
  AnnotatedTextView,
  WordChipsArrayView,
  useL10nWordDetailModal,
} from "lingop/ui/react-native";

function Vocabulary({ annotatedText, words, lang, lingopClient }) {
  const details = useL10nWordDetailModal({ lingopClient, guiLang: "en" });
  return <>
    <AnnotatedTextView
      annotatedText={annotatedText}
      lingopClient={lingopClient}
      onTokenPress={details.onTokenPress}
    />
    <WordChipsArrayView
      words={words}
      lang={lang}
      guiLang="en"
      lingopClient={lingopClient}
    />
    {details.ModalComponent}
  </>;
}
```

Chips restore canonical casing from the existing SBWords cache for scripts with
case, retain duplicates and input order, and wrap in the language's direction.
`onL10nWordTap(word, nativeEvent)` overrides built-in details when a parent owns
the presentation. `style`, `chipStyle`, `wordStyle`, and `emptyLabel` customize
the array. Large lists should be paginated by the host app.

Details accept the shared `L10nWordDetailData` shape. Supplied annotations and
linearized token indices preserve the original reading, gloss, and morphemes.
Raw words use the existing public `WORDS` localization/annotation pipeline,
which may generate missing data under the client's existing policy. Dictionary
glosses, curated explanations, Han-character components/readings, nested
components, and simplified Chinese all reuse existing Lingop helpers and data.
Non-English GUI glosses use `fetchAndGenGloss`; `translate` accepts an app-owned
OAT function for interface labels (English by default). Component dictionary
readings/glosses retain their source language. Failed requests expose retry;
changing selection hides old results immediately and ignores late responses.

The Strokes tab uses `react-native-svg` with the existing local stroke provider
and progressive diagrams. Native apps should install `react-native-svg` (15.13+;
Expo: `npx expo install react-native-svg`). It is an optional peer for non-native
consumers. The standalone diagram is also exported from
`lingop/ui/react-native/stroke-order-view`. `strokeDataProvider` can override data
resolution. Metro includes local stroke datasets in native bundles (the demo's
Android bundle is approximately 54 MB); lazy JavaScript imports do not provide
web-style production code splitting on native. The linked temporary Expo demo
uses `EXPO_NO_METRO_LAZY=1` to avoid dev-server paths outside its project root.

Optional `wordStreaksData` accepts `NativeWordStreaksData`, structurally matching
the existing provider's counts, ensure, set-to-value, and delete methods. The
host can pass the shared `useUserWordStreaksData()` result directly, or supply
its own persistence adapter. `showWordStreaks` enables chip
indicators; `showWordDetailStreakControls` / `showWordStreakControls` control
sheet/body actions. Learnt updates all selected morphemes to the shared mastery
threshold and closes only after success. Reset clears the selected entries;
failed saves remain visible. Controls are omitted without this adapter.

`speechController` connects details to shared Lingop speech (see below). The legacy
`onPlayAudio(annotation)` callback remains available when no controller is supplied.
Without either, no audio button is shown. Browser speech, browser localStorage tab
preferences, and anchored HTML popovers are not used. Native character-tab
selection lasts for the mounted word detail. `L10nWordDetailContent` can be
embedded in an app-owned screen instead of the supplied modal.

### Shared native speech

Create one `createSpeechController` from `lingop/speech` per app. Native device
voices occupy the same role as browser voices: actual device voice identifiers
are discovered at runtime, matched using Lingop's language/locale rules, and
listed alongside permitted API voices. Automatic selection prefers device speech;
a selected voice that disappears reports an error instead of silently changing
provider or accent. Device playback does not wait for a cloud request.

Expo apps can supply their installed modules without making Expo a dependency
of Lingop:

```tsx
import * as Speech from "expo-speech";
import * as Audio from "expo-audio";
import { createSpeechController } from "lingop/speech";
import { createExpoSpeechAdapter, createExpoAudioAdapter } from "lingop/speech/expo";

// Run once during app startup, before enabling playback.
await Audio.setAudioModeAsync({
  playsInSilentMode: true,
  interruptionMode: "duckOthers",
  shouldPlayInBackground: false,
});
const speechController = createSpeechController({
  device: createExpoSpeechAdapter(Speech, { useApplicationAudioSession: true }),
  audio: createExpoAudioAdapter(Audio),
  apiVoiceAccessProfile: "ONE_PER_LANG", // NONE (default), ONE_PER_LANG, or ALL
  // supabaseClient: appSupabaseClient, // required for MEMBER_CONTENT
  // preferences: restoredPreferences,
  // onPreferencesChange: preferences => savePreferences(preferences),
});

<AnnotatedTextView
  annotatedText={annotation}
  speechController={speechController}
  speechContext={{ contentContext: "PUBLIC_CONTENT", ref: { file: "lingodex" } }}
/>;
```

Use the real content context/reference for the sentence; the example ref applies
to Lingodex content. Annotation prebake metadata is not a public speech reference.
Pass the same controller to `WordChipsArrayView`, `L10nWordDetailContent`, or
`useL10nWordDetailModal`. Individual words use the existing public `WORDS` speech
reference rather than the containing sentence's reference.

Each view includes Play/Stop, voice choice, speed, and error/retry controls.
`showActionPlayAudio={false}` hides sentence controls. `SpeechControls` and
`SpeechVoicePicker` are also exported for custom layouts. Playback cancels on
view dismissal/content change, when the app leaves the foreground, and when a
new utterance starts. An older view cannot stop playback owned by a newer view.
Preferences are shared in memory; persist the callback snapshot in the app's
settings store and supply it on startup. `controller.dispose()` releases playback
when the app no longer needs the controller.

Other native stacks can implement `DeviceSpeechAdapter` and `SpeechAudioAdapter`
without Expo. The shared resolver owns cloud voice access, text preparation,
metadata caching, content references and authentication; adapters only enumerate
voices or play audio. The existing web speech API retains browser playback and
uses the same extracted language/API logic.

The host owns the iOS audio session. The Expo device adapter defaults to the
system-managed session; the example explicitly uses the application's configured
session. Verify silent mode, calls, headphones and pronunciation on a real iPhone;
simulator completion callbacks cannot prove audible output or dialect quality.
For playback-only Expo builds, disable microphone/recording permissions and
background playback in the `expo-audio` config plugin. No recording is needed.

## Rendering Annotation in Next.js

```tsx
import { AnnotatedTextView } from "lingop/ui/next";
import "lingop/ui/next/annotated-text.css";

<AnnotatedTextView annotatedText={annotatedText} />;
```

## Bilingual UI in Phaser

`lingop/ui/phaser` provides renderer-native Phaser components; it does not use
HTML or a DOM overlay. Phaser is an optional peer dependency, so importing
Lingop's core, Next.js, or React Native entry points does not load Phaser.

```ts
import {
  PhaserBilingualButton,
  PhaserFocusSpeechController,
  formatLingopLanguagePair,
} from "lingop/ui/phaser";

const speech = new PhaserFocusSpeechController(scene, {
  speak: (text) => speechSynthTTS.speak({
    text,
    lang: focusLang,
    apiVoiceAccessProfile: "NONE",
  }),
});

new PhaserBilingualButton(scene, 400, 300, {
  width: 360,
  height: 68,
  content: {
    gui: { lang: guiLang, text: "Languages" },
    focus: {
      lang: focusLang,
      text: focusLanguageText,
      annotatedText: focusLanguageAnnotation,
    },
    suffix: `: ${formatLingopLanguagePair(guiLang, focusLang)}`,
  },
  speechHost: speech,
  icon: { texture: "tabler-language", size: 24 },
  onPress: openLanguages,
});
```

The Phaser surface includes:

- `PhaserAnnotatedText` for furigana, Jyutping, token-aware wrapping, and crisp
  high-DPI text;
- `PhaserBilingualLabel` for consistently aligned horizontal and vertical
  GUI/focus-language labels;
- `PhaserBilingualButton` for icons, selected and disabled states, and toggle
  controls;
- `bindPhaserFocusSpeech` and `PhaserFocusSpeechController` for hover, tap, and
  keyboard-driven speech behavior;
- `PhaserSpeechHint` for the animated screen-level shortcut and active speech
  display;
- `sharpenPhaserSceneText` and `formatLingopLanguagePair` utilities.

Applications provide their own translations, `AnnotatedText` values, icon
textures, colors, and TTS function. This keeps game content and visual identity
outside the shared renderer.

The ATV stylesheet includes its LS Jyutping, Noto Sans JP, and Linja Laso font
assets, so consumers do not need to copy OmniAccess's `/public/fonts` files.
OmniAccess's approximately 24 MB `NotoColorEmoji-Regular.ttf` is deliberately
not bundled: its CBDT/CBLC format carries a substantial download cost and can
be slow or unstable in Safari/WebKit. The exported stylesheet contains a
commented `@font-face` and CSS-variable example for consumers that intentionally
choose to host and enable it themselves.

`AnnotatedTextView` works with or without the `UserWordStreaksDataProvider`
described above. When the provider is present, ATV consumes word streaks for
unfamiliar-word hints. Without it, streak-dependent hinting, word-detail
interaction, and unfamiliar-word styling are disabled. Its `showSpelling`,
`showGlossText`, and `showGlossEmoji` inputs accept `ON_HINT` in addition to
`NEVER` and `ALWAYS`.

ATV resolves all visible emoji glosses as one deduplicated batch. While that
batch is pending it shows the inline emoji spinner immediately instead of
briefly showing the English-gloss fallback. The known fallback text remains as
an invisible sizing layer, keeping main text and spelling visible without
recentering the token row when emojis arrive. Consumers that need to coordinate
screen navigation can use `onEmojiLoadStateChange`; the wrapper also exposes
the same state as `data-emoji-loading="true"` or `"false"`.

The OmniAccess-compatible play action is enabled with
`showActionPlayAudio`. `actionsPlacement` accepts `LEFT_RIGHT`, `RIGHT_LEFT`,
`TOP`, or `BOTTOM`; the wrapper also respects the main language's writing
direction. Its requested action slot is reserved before asynchronous voice
detection completes, preventing the annotation from moving when the play
button appears. A per-ATV `apiVoiceAccessProfile` overrides the value from
`LingopClientDataProvider`. The default profile is `NONE`, which permits
browser voices only.

Browser voices need no content metadata. If the selected voice is a cloud
voice, `contentContext_forAPISpeech` tells the speech layer which lookup and
creation path applies. `PUBLIC_CONTENT` additionally needs
`contentRef_forAPISpeech`, while `MEMBER_CONTENT` needs the configured
Supabase client. `LIMITED_TEMP_ANON` needs neither of those extra values.

`shouldPreloadSpeech` remains explicitly opt-in. It is a no-op for a browser
voice; for a cloud voice it resolves (and, when absent, may create/cache) the
same audio that playback would use, then asks the browser to buffer its file.

Use the OmniAccess-compatible `astyle` input for per-instance typography,
colours, spacing, and annotation placement. Inputs are merged with the exported
defaults:

```tsx
import {
  AnnotatedTextView,
  DEFAULT_ANNOTATED_TEXT_STYLE,
  type AnnotatedTextStyle,
} from "lingop/ui/next";

const astyle: AnnotatedTextStyle = {
  ...DEFAULT_ANNOTATED_TEXT_STYLE,
  mainTextSize: 20,
  spellingColor: "#475569",
  glossPlacement: "bottom",
};

<AnnotatedTextView annotatedText={annotatedText} astyle={astyle} />;
```

Image export is available through the component ref. `html2canvas` is loaded
only when one of these methods is called:

```tsx
import { useRef } from "react";
import {
  AnnotatedTextView,
  type AnnotatedTextViewHandle,
} from "lingop/ui/next";

const annotatedTextRef = useRef<AnnotatedTextViewHandle>(null);

<AnnotatedTextView ref={annotatedTextRef} annotatedText={annotatedText} />;

await annotatedTextRef.current?.requestDownloadImage(0);
const image = await annotatedTextRef.current?.requestImageData(2);
const spelling = annotatedTextRef.current?.getSpelling();
await annotatedTextRef.current?.triggerSpeechSynthesis();
```

As of 2026-09-24, color emojis use the browser's default font selection. The
old automatic Noto preference and its coupled flip rule remain as disabled code
in the stylesheet: consistent artwork is no longer a priority for Camp Lingo
products. Noto-only color flips now use a cached, lightweight platform estimate
applied after hydration: Android/ChromeOS/Linux are likely Noto; Apple/Windows
are not. This does not inspect actual glyph fonts; Android OEM fonts, Linux
configuration and user overrides can differ. Set `colorEmojiFontIsNoto={true}`
or `{false}` on `AnnotatedTextView` when the consumer knows its color font.
This prop changes only Noto-specific flips, not font selection. Explicit
monochrome mode still uses Noto Emoji and retains its flips independently.
No font downloads, canvas measurements or permission prompts are added.

The optional stylesheet supplies color and monochrome emoji font handling.
Critical layout remains built into the component, so importing the
stylesheet is not required when an application provides its own ATV styles.
Consumers can override its font stacks with CSS custom properties:

```css
.annotated-text-view {
  --lingop-atv-color-emoji-font-family: "My Color Emoji", sans-serif;
  --lingop-atv-bw-emoji-font-family: "My Monochrome Emoji", sans-serif;
}
```

## Bilingual annotated text in Next.js

`BiTextView` renders a localization and its source text together, annotates
whichever side is the focus language, and owns its annotation, speech, copy,
image-download, word-detail, and feedback controls. It requires
`LingopClientDataProvider`, `OATDataProvider`, and
`UserLingoPrefsDataProvider` above it:

```tsx
import { BiTextView } from "lingop/ui/next";
import "lingop/ui/next/annotated-text.css";
import "lingop/ui/next/bi-text-view.css";
import "lingop/ui/next/l10n-word-detail-content.css";
import "lingop/ui/next/l10n-word-detail-popover.css";

<BiTextView
  localization={localization}
  guiLang={guiLang}
  focusLang={focusLang}
  showGuiLangText
  contentContext="LIMITED_TEMP_ANON"
/>
```

Lingop session-caches transient annotations through its shared client. A
consumer that needs cross-session persistence can load its stored value into
`preparedFocusA8n` and save newly generated values from `onAnnotated`; storage
keys, migrations, and eviction policy deliberately remain consumer-owned.

## Spelling-system picker in Next.js

`SpellingSystemPicker` is the reusable picker content without a dialog or
dialog trigger. Consumers remain responsible for placing it in their own page,
sheet, or dialog and closing that surface from `onDone`:

```tsx
import { SpellingSystemPicker } from "lingop/ui/next";
import "lingop/ui/next/annotated-text.css";
import "lingop/ui/next/spelling-system-picker.css";

<SpellingSystemPicker
  lang={focusLang}
  guiLang={guiLang}
  onDone={() => setPickerOpen(false)}
  showPreviewAudio
/>;
```

Render it beneath `OATDataProvider` and `UserLingoPrefsDataProvider`. OAT
provides localized interface text and the static example annotation; the
preferences provider supplies and persists the selected system. The preview
uses Lingop's `AnnotatedTextView`, so its browser/cloud voice configuration is
the same as any other Lingop ATV. `SpellingSystemPickerAsSegment` provides the
existing compact three-option variant.

## Speech/TTS in Next.js

```ts
import { speechSynthTTS } from "lingop/ui/next";

await speechSynthTTS.initSpeechSynthTTS(); // Optional browser-tab preload.
await speechSynthTTS.speak({
  text: "hello",
  lang: "en",
  apiVoiceAccessProfile: "ONE_PER_LANG",
  contentContext: "LIMITED_TEMP_ANON",
});
```

For English word explanations that contain Cantonese or Japanese words, pass
`embeddedLang` explicitly so Han characters use the learning language rather
than the English voice's language guess:

```ts
const abortController = new AbortController();
await speechSynthTTS.speak({
  text: "Contraction of 嘅呀, meaning it is so.",
  lang: "en",
  embeddedLang: "yue",
  apiVoiceAccessProfile: "ONE_PER_LANG",
  contentContext: "LIMITED_TEMP_ANON",
  signal: abortController.signal,
});
```

English and embedded CJK fragments play in order using each language's preferred
voice and the same access profile. `embeddedVoiceOverride` selects an available
voice for the embedded words without saving a preference; `voiceOverride` still
selects the English voice. `signal` stops the whole sequence, including pending
cloud playback. Existing calls without `embeddedLang` keep their single-language
behavior. This currently supports English explanations with Japanese, Cantonese,
or Chinese scripts; Latin-script language pairs need explicit word boundaries
and are left unchanged. Use this for dynamic TTS, not a reference to an existing
recording. The pure `segmentSpeechText` helper is also exported from
`lingop/speech` for other platform adapters.

`onLoadingChange(isLoading)` reports voice discovery, cloud metadata and audio
buffering. It becomes false on browser utterance start or cloud audio `playing`,
true on audio `waiting`, and false on completion, error or cancellation. Apps can
use this optional callback to display a loading indicator without accessing
Lingop's internal audio element.

For `MEMBER_CONTENT`, pass the app's Supabase client: `speak({ ..., contentContext: "MEMBER_CONTENT", supabaseClient })`.

## Legacy Code Migration Notes

- Keep this README.md updated
- Public exports from migrated files should keep their existing names so old callers can move gradually.
- Internal helper names, private structure, and module layout can be renamed or reworked for clarity, efficiency, and modularity.
- Retain comments from legacy code when they explain intent, tradeoffs, known limits, future work, or surprising implementation details. Trim only stale comments or comments that merely restate the code.
- Prefer small, explicit modules with narrowly scoped responsibilities.
- Keep UI code and non-UI code separate even when a legacy file mixed both concerns.
- Add runtime validation where the old data shape is known to be inconsistent or externally supplied.

## Design Decisions

### Choosing a LingoProcessor backend

`backendTarget` is optional and accepts `"production"`, `"staging"`, or `"gcloud-run"`.

| Selection | Destination |
| --- | --- |
| `"production"` (default) | Existing production at `https://lingoprocessor.omnilingualaccess.com` |
| `"staging"` | Existing Replit development URL (`BE_API_STAGING_URL`) |
| `"gcloud-run"` | `https://lingoprocessor-v20-mnykwbetrq-uc.a.run.app` |

Existing `useStagingBackend: true/false` calls retain their behavior. An explicit
`backendTarget` takes precedence over that legacy flag, including explicit
`"production"` with `useStagingBackend: true`. Invalid target strings throw instead
of silently selecting another backend.

```tsx
// Opt in for one consumer when it is ready to migrate.
<LingopClientDataProvider supabaseClient={supabaseClient} backendTarget="gcloud-run">
  <App />
</LingopClientDataProvider>
```

The same option is accepted by `createLingoDataClient`, annotation/translation
helpers (including sign-language translation), speech options, dictionary word
generation, and OAT/prebake build services. For custom API calls, pass the full
selection to `getBEApiBaseUrl` from `lingop/core`:

```ts
const { backendTarget, useStagingBackend } = useLingopClientData();
const baseUrl = getBEApiBaseUrl({ backendTarget, useStagingBackend });
```

Build CLIs accept `LINGOP_BACKEND_TARGET=gcloud-run`; it takes precedence over
`LINGOP_USE_STAGING_BACKEND`. Leaving both unset preserves production defaults.
`BE_API_GCLOUD_RUN_URL`, `BackendTarget`, and `parseBackendTarget` are exported
from `lingop/core` for configuration integrations.

Backend API request deduplication, public annotation batches, cached localization
results, voice lists, and generated audio metadata distinguish the resolved
backend URL. Changing the React provider's selection creates a new data client.
For non-React code, create a new client for each target and keep caller-owned
annotation/translation cache refs separate. Direct Supabase caches still follow
the injected database client; backend selection does not select a new database.

Cloud Run currently uses the existing live accounts and data. Adding support in
this library does not move consumer traffic; consumer configuration changes and
deployment are separate migration steps. Keep the legacy staging URL intact so
existing development reachability checks and saved staging toggles keep working.

### Client architecture

- Supabase is dependency-injected because runtime setup differs across browser, SSR, and React Native. This package does not instantiate Supabase.
- Public APIs accept Supabase clients loosely and cast internally to a small runtime shape. This avoids pushing Supabase's deep generated query types into app code while keeping row validation at module boundaries.
- `createLingoDataClient()` owns annotation and translation caches per client instance, matching the old context behavior without React state. Apps should reuse the same instance across normal user navigation to preserve cache continuity.
- Supabase user id and access token are derived from the injected Supabase client via `auth.getUser()` and `auth.getSession()` when owner-specific operations need them.
- External backend selection uses `backendTarget`, with backward-compatible `useStagingBackend` fallback; production is the default.
- Context-private lookup helpers remain modular inside this package, but package consumers should prefer `createLingoDataClient()` for annotation/localization workflows.

## Current Modules

- `src/core/backend-api.ts` contains shared backend API URLs and target selection for external backend calls, including opt-in `gcloud-run` support.
- `src/core/annotation/api-client.ts` calls the backend `/api/annotate` endpoint with short-window batching and in-flight request deduping.
- `src/core/annotation/converters.ts` converts between raw annotation entries and frontend-friendly annotated text structures.
- `src/core/annotation/fetch-annotation.ts` orchestrates annotation lookup across caller-provided in-memory cache, public annotation API, optional caller-provided Supabase client, and backend annotation generation. 
- `src/core/annotation/types.ts` contains the annotation types extracted from old `globals.d.ts` files.
- `src/core/emojify.ts` ports the legacy emoji-gloss generator and black/white emoji compatibility helpers. Emoji rows use a shared module cache.
- `src/core/language/` contains language metadata, script metadata, localized language names, OpenAI voice metadata, and language lookup helpers. Large metadata tables live under `src/core/language/data/`.
- `src/core/lingo-data-client.ts` is the platform-neutral successor to old `LingoDataContext`. It owns annotation and translation caches and exposes localization, translation-cache, annotation, re-generation, and re-annotation methods.
- `src/core/misc.ts` contains platform-neutral utility functions ported from old `utils/misc.ts`. Browser image behavior remains outside the core surface.
- `src/core/sb-words.ts` ports the legacy Supabase `words2` cache, core-word checks, and one-word gloss generation through a shared module cache.
- `src/core/translation/` contains platform-neutral translation types and internal table/localization helpers used by `createLingoDataClient()`.
- `src/core/user-word-exposures.ts` contains the platform-neutral Supabase helpers for creating, reading, incrementing, and deleting per-user word exposure rows. It is exported from `lingop/core`.
- `src/core/user-word-streaks.ts` contains internal helpers used by the shared word-streaks provider. It is intentionally not exported from `lingop/core`; app code should use the provider/hooks from `lingop/react` or the platform wrappers.
- `src/core/word-explicitations.ts` loads and filters Supabase `word_explicitations` rows through a shared module cache.
- `src/core/word-lists.ts` loads public Supabase word-list source and localization rows through shared module caches.
- `src/ui/next/cookies.ts` contains browser cookie helpers separated from platform-neutral core utilities.
- `src/ui/next/annotated-text-image.ts` lazily loads `html2canvas` for the annotated-text ref's image-data and download methods.
- `src/ui/next/bi-text-view.tsx` contains the interactive bilingual localization-and-annotation component originally designed for CL Translate.
- `src/ui/next/spelling-system-picker.tsx` contains the dialog-agnostic full and compact spelling-system pickers. Consumers own dialog presentation and lifecycle.
- `src/ui/next/speech-synth-tts.ts` contains browser/Next speech synthesis helpers exported from `lingop/ui/next`.
- `src/ui/next/user-word-streaks.tsx` contains the Next user-word-streaks provider and hook exported from `lingop/ui/next`.
- `src/ui/react-native/` is reserved for React Native-specific UI helpers.

### Preparing V3 word-list pages

`prepareWordListsV3()` from `lingop/prebake/build` is the explicit V3 build-time
entry point. Existing `prebake-preflight` configurations continue to use V2 until
their consumers migrate; there is no global default switch or duplicate V3 CLI.

Pass a configured `createLingoDataClient()`, the curated `rootListId`, `focusLangs`,
`guiLangs`, and a persisted `WordListsV3Enrichment` cache. The returned catalog has
language-owned lists, ordered word rows, child IDs, localized titles, annotations,
complete interface glosses, and emoji. Consumer URL slugs, images, HTML, SEO and
publication remain outside Lingop. Missing content counterparts are omitted;
underscore-prefixed organizational nodes without words may bridge a shared root.
Dangling edges and cycles fail preparation. No source/localized position matching,
word deduplication, re-explicitation, or V2 table fallback is performed.

Annotations are keyed by exact language/text and glosses by complete English gloss
and GUI language, retaining alternatives such as `eye / mom's dad`. Existing
human-verified SBWords and word explicitations take precedence. Optional `services`
(the existing `PrebakeBuildServices` values, including the build-only private key)
lets missing interface glosses use bounded build translation batches instead of
the anonymous per-word generation endpoint. `fetchAndGenGloss` now accepts
`generateIfMissing: false` to return null on an SBWord cache miss; its default
behavior is unchanged. Explicitation display can still resolve its emoji.

List data is refreshed each run. Enrichment is retained until the consumer removes
selected entries for editorial refresh; no automatic wording rewrite occurs.
Use `checkpoint(cache)` to persist completed batches atomically and `report()` for
progress. Missing required annotations or glosses fail the build before publication.
The consumer must publish a fresh build to expose list edits to a static site.

### Camp Lingo memberships

`lingop/billing` exports `getCampLingoTier` and `hasCampLingoAccess`. Core grants
paid access to ready-made learning apps; Plus also grants Translate & Learn fast
translations. Existing Camp Lingo and complimentary subscription products map
to Plus. Unknown products fail closed. Always enforce costly access server-side.

`CampLingoPricing` from `lingop/ui/next` supplies Free/Core/Plus comparison,
fixed-currency prices from the billing service, sign-in, Checkout, upgrades,
renewal-time downgrades, and billing management. Import
`lingop/ui/next/camp-lingo-pricing.css` once. Place it under the existing
`LingopClientDataProvider` and OAT provider (or supply `onSignIn` for your own
auth dialog). Pass `translate={OAT}` for localized feature copy.

```tsx
<CampLingoPricing guiLang={guiLang} translate={OAT}
  recommendedTier="plus"
  plans={{ core: { disabled: true, reason: OAT("Core supports the other Camp Lingo learning apps.") } }} />
```

Each plan supports `hidden`, `disabled`, `reason`, and additional `features`.
Disabled plans remain visible with an Unavailable badge and no action button.
Current paid plans are labeled in the card; subscribers manage cancellation
through the single Manage billing action. The Free card is informational and
never shows a CTA; consumers keep their normal close control for pricing dialogs.
Use `recommendedTier="core"` for static learning apps. Checkout returns to the
originating app, and the provider reconciles membership before refreshing
entitlements. For local/sandbox testing, set `apiBaseUrl` on the component and
`billingApiBaseUrl` on the provider to the same test billing service. Never ship
a Stripe secret to a consumer; only the centralized billing server uses it.
Normal localhost consumers can use the default production billing service:
the central service allows exact loopback origins and return destinations,
including development ports. The same verified-user authentication applies.

Set `linkToTranslateApp={false}` when embedding `CampLingoPricing` inside Translate & Learn. Other consumers link mentions of the app to `https://translate.camplingo.com` in a new tab by default. Translations retain the `{_TRANSLATE_APP_}` placeholder so the component can render the brand and link safely.
