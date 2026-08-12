# lingop (⚠️ Internal Package Only - Not Ready for Unapproved Apps Yet)

Shared TypeScript code for Lingo projects.

This codebase is intended to be used from both web apps, such as Next.js TypeScript apps, and native apps, such as React Native TypeScript apps.

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

`oat-preflight` reads `_H_PERSONAL_OVERRIDE_KEY`, loads the root `oat.config.ts`, generates translations, then generates static annotations.

Lingop developers write normal `OAT("source text")`, `OAT2("source text")`, and `getStaticFocusLangAText("source text")` calls directly in shared components. Lingop's build scans those calls and generates `lingopOATSourceData`; the packaged `oat-preflight` inherently combines it with the consumer's locally scanned calls. Consumers do not maintain a separate string list or configure shared source data.

At runtime, import `OATDataProvider` and `useOAT` from `lingop/oat/react`. The provider receives `guiLang` and `focusLang` read-only plus consumer-provided `loadTranslations` and `loadStaticAnnotations` functions. Web consumers can load the generated files with `fetch`; React Native consumers can use an asset manifest or another native-compatible loader.

## Camp Lingo Auth Form in Next.js

`CampLingoAuthForm` is the shared Camp Lingo browser login/signup UI. It owns the common Camp Lingo branding and labels, email/password flows, Google Identity Services integration, and forgot-password destination. It uses basic DOM elements and stable class names so consumers can override its appearance without taking on a UI-framework dependency.

The consumer supplies its existing browser-configured Supabase client and current GUI language. Lingop does not create or configure Supabase, and the form is currently part of `lingop/ui/next`, not the React Native UI.

```tsx
import {
  CampLingoAuthForm,
  CampLingoAuthFormMode,
} from "lingop/ui/next";
import "lingop/ui/next/camp-lingo-auth-form.css";

<CampLingoAuthForm
  supabaseClient={supabaseClient}
  guiLang={guiLang}
  initialMode={CampLingoAuthFormMode.LOG_IN}
  onSuccessfulAuth={(mode) => handleSuccessfulAuth(mode)}
/>;
```

The stylesheet provides the default Camp Lingo appearance. Consumers can override the `lingop-camp-lingo-auth-form*` classes or pass an additional root `className`.

## Install

- `npm install lingop@github:fullcells/lingop#v0.3.X` // Installs Directly from Github // Replace `X` with version number.

// To update existing lingop if outdated (`npm ls lingop` shows version number)
- `npm update lingop`

Release tags follow the package version in `package.json`, so `0.3.X` is published as `v0.3.X`.

## To Tag a New Version

- Commit and push everything first
- `git tag -a v0.3.X -m "Release v0.3.X"`
- `git push origin v0.3.X`

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
- `updateTranslationsCaches(rows)`: merges translation rows into the owned translation cache and keeps the newest entries first.
- `getT9nCacheDateBySC(sourceContent)`: reads the last cache timestamp tracked for a source-content record.
- `_updateT9nCacheDatesBySCs(sourceContents)`: updates cache timestamps for one or more source-content records.
- `retranslate({ id })`: loads the existing translation row, generates fresh text through backend `/api/translate-create-limited-anon`, updates that Supabase row's `target_text`, `created_at`, and backend-reported `translator`, then refreshes the client cache.
- `updateTranslationWithHumanEdit({ id, targetText })`: updates an existing Supabase translation row's `target_text`, `created_at`, and `translator: "USER"`, then refreshes the client cache.
- `fetchAnnotation({ localization })`: returns annotation data for a localization, using cache/Supabase/backend lookup as needed.
- `reGenOwnerAnnotation({ localization, skipDeletionOfExisting? })`: deletes and rebuilds an owner-scoped annotation, then refreshes the annotation cache.
- `reAnnotateWithExistingData(input)`: re-runs backend annotation generation from existing stored annotation data and updates the annotation cache with the returned rows.
- `loadWordExplicitationsRows()`: loads and caches Supabase `word_explicitations` rows.
- `getOneWayWordExplicitations({ source_lang, source_word, target_lang })`: filters the cached word-explicitation rows into the legacy one-way shape.
- `loadEmojiData()` and `generateEmoji(en_gloss, study_word?, study_lang?)`: load shared cached Supabase emoji rows and generate emoji text for English glosses.
- `isNotCoreWord(word_lang, word, gloss?)`, `getSBWordsForLangDir(word_lang, gloss_lang)`, `refreshCoreSBWordsCache(word_lang, gloss_lang)`, and `fetchAndGenGloss({ source_lang, source_word, target_lang })`: use the shared SBWords cache for core-word checks and one-word gloss generation.
- `createWordExposureRow(...)`, `addWORDExposureNow(...)`, `getWORDExposureRow(...)`, and `deleteWORDExposureRow(...)`: manage the authenticated user's per-word exposure rows through the Supabase client already owned by `LingoDataClient`.

Additional core helpers:

- `getBinderDocsByMinL10nsOrder([{ doc_id, l10ns }], priorityDocIds?)`: recommends a learning order for already-loaded binder doc localization caches. It normally minimizes new words, with one narrow recurring-word exception for vocabularies above 1,000 unique l10ns. Omitted priorities default to doc `179` (for LingoTrivia); pass `[]` to disable defaults.
- `fetchBinderDocsByMinL10nsOrder({ supabaseClient, binder_id, lang, priorityDocIds? })`: loads `cache_binder_doc_l10ns` rows for a binder/language pair and returns the same recommended ordering.
- Low-level `loadWordExplicitationsRows({ supabaseClient })` and `getOneWayWordExplicitations(input, { supabaseClient })` remain exported for gradual migration, but app code should prefer the existing `LingoDataClient`.

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

## User Word Streaks in Next.js

User word streaks are exposed through the Next UI provider and hook, not through `lingop/core`. Consumers read and write one unified `userWordStreaks` value regardless of whether the backing store is currently localStorage or Supabase.

Wrap the app with the provider and pass the same app Supabase client you use elsewhere. `focusLang` may be `null`; the provider waits to hydrate or sync until a language exists.

```tsx
import { UserWordStreaksDataProvider } from "lingop/ui/next";

<UserWordStreaksDataProvider
  focusLang={focusLang}
  supabaseClient={supabaseClient}
>
  <Component {...pageProps} />
</UserWordStreaksDataProvider>;
```

The provider uses `useSupabaseSignedInStatus()` internally, which checks `supabaseClient.auth.getUser()` and follows later sign-in/sign-out events through `supabaseClient.auth.onAuthStateChange()`. While auth status is pending, it waits to hydrate streak data. Signed-out users hydrate from `localStorage` and write changes back there. Signed-in users hydrate from Supabase, migrate existing localStorage data for a language when Supabase has no row, and queue Supabase syncs after changes.

Downstream components use the hook:

```tsx
import { useUserWordStreaksData } from "lingop/ui/next";

const {
  userWordStreaks,
  setUserWordStreaksToValue,
  setUserWordStreaksByDelta,
  setUserWordStreaksToMin1,
  deleteUserWordStreaks,
} = useUserWordStreaksData();

const spanishStreaks = userWordStreaks.es ?? {};

await setUserWordStreaksToValue("es", ["hola"], 1);
await setUserWordStreaksByDelta("es", [{ word: "hola", streakDelta: 1 }]);
await setUserWordStreaksToMin1("es", ["adios"]);
await deleteUserWordStreaks("es", ["hola"]);
```

## User Word Exposures

Word exposures complement word streaks with per-word encounter counts and recent
timestamps. Unlike the Next.js word-streak provider, exposure methods are
platform-neutral and available on the long-lived `LingoDataClient`. Supply the
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

## Rendering Annotation in Next.js

`import { AnnotatedTextView } from "lingop/ui/next";

<AnnotatedTextView annotatedText={annotatedText} />;`

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

- Supabase is dependency-injected because runtime setup differs across browser, SSR, and React Native. This package does not instantiate Supabase.
- Public APIs accept Supabase clients loosely and cast internally to a small runtime shape. This avoids pushing Supabase's deep generated query types into app code while keeping row validation at module boundaries.
- `createLingoDataClient()` owns annotation and translation caches per client instance, matching the old context behavior without React state. Apps should reuse the same instance across normal user navigation to preserve cache continuity.
- Supabase user id and access token are derived from the injected Supabase client via `auth.getUser()` and `auth.getSession()` when owner-specific operations need them.
- External backend environment is selected with `useStagingBackend`; public `/api/lingoprocessor/*` helpers call a fixed base URL atm (to be merged with backend enviro in far future)
- Context-private lookup helpers remain modular inside this package, but package consumers should prefer `createLingoDataClient()` for annotation/localization workflows.

## Current Modules

- `src/core/backend-api.ts` contains shared backend API URLs and environment selection for external backend calls. Production is the default; callers opt into staging with `useStagingBackend: true`.
- `src/core/annotation/api-client.ts` calls the backend `/api/annotate` endpoint with short-window batching and in-flight request deduping.
- `src/core/annotation/converters.ts` converts between raw annotation entries and frontend-friendly annotated text structures.
- `src/core/annotation/fetch-annotation.ts` orchestrates annotation lookup across caller-provided in-memory cache, public annotation API, optional caller-provided Supabase client, and backend annotation generation. 
- `src/core/annotation/types.ts` contains the annotation types extracted from old `globals.d.ts` files.
- `src/core/emojify.ts` ports the legacy emoji-gloss generator and black/white emoji compatibility helpers. Emoji rows use a shared module cache.
- `src/core/language/` contains language metadata, script metadata, localized language names, OpenAI voice metadata, and language lookup helpers. Large metadata tables live under `src/core/language/data/`.
- `src/core/lingo-data-client.ts` is the platform-neutral successor to old `LingoDataContext`. It owns annotation and translation caches and exposes localization, translation-cache, annotation, re-generation, and re-annotation methods.
- `src/core/misc.ts` contains platform-neutral utility functions ported from old `utils/misc.ts`. Browser image helpers based on `html2canvas` and element download/image capture were intentionally not ported.
- `src/core/sb-words.ts` ports the legacy Supabase `words2` cache, core-word checks, and one-word gloss generation through a shared module cache.
- `src/core/translation/` contains platform-neutral translation types and internal table/localization helpers used by `createLingoDataClient()`.
- `src/core/user-word-exposures.ts` contains the platform-neutral Supabase helpers for creating, reading, incrementing, and deleting per-user word exposure rows. It is exported from `lingop/core`.
- `src/core/user-word-streaks.ts` contains internal helpers used by the Next user-word-streaks provider. It is intentionally not exported from `lingop/core`; app code should use `lingop/ui/next`.
- `src/core/word-explicitations.ts` loads and filters Supabase `word_explicitations` rows through a shared module cache.
- `src/ui/next/cookies.ts` contains browser cookie helpers separated from platform-neutral core utilities.
- `src/ui/next/speech-synth-tts.ts` contains browser/Next speech synthesis helpers exported from `lingop/ui/next`.
- `src/ui/next/user-word-streaks.tsx` contains the Next user-word-streaks provider and hook exported from `lingop/ui/next`.
- `src/ui/react-native/` is reserved for React Native-specific UI helpers.
