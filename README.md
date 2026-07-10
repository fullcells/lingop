# lingop (⚠️ Internal Package Only - Not Ready for Unapproved Apps Yet)

Shared TypeScript code for Lingo projects.

This codebase is intended to be used from both web apps, such as Next.js TypeScript apps, and native apps, such as React Native TypeScript apps.

## Install

Consumers can install Lingop directly from GitHub:

`npm install lingop@github:fullcells/lingop#v0.2.1`

Current release tags follow the package version in `package.json`, so `0.2.0` is published as `v0.2.0`.

## Lingo Data Usage

For localization/translation, and annotation workflows, prefer `createLingoDataClient()` from `src/core/lingo-data-client.ts`.

The client owns its in-memory annotation and translation caches. Runtime-specific dependencies, such as Supabase setup and token access, are dependency-injected by the app.

Create one long-lived `LingoDataClient` per user-facing runtime/session and reuse it across pages, routes, or screens.

Low-level annotation API calls, `callAnnotate_storedForOwner()` remains public and calls backend `/api/annotate`.

## `LingoDataClient` Public API

`createLingoDataClient()` returns a long-lived client instance with these callable methods:

- `fetchLocalization({ l10n_lang, sourceContent, isPublic? })`: returns the newest localization for a source-content record, using the client cache first and generating/fetching as needed.
- `updateTranslationsCaches(rows)`: merges translation rows into the owned translation cache and keeps the newest entries first.
- `getT9nCacheDateBySC(sourceContent)`: reads the last cache timestamp tracked for a source-content record.
- `_updateT9nCacheDatesBySCs(sourceContents)`: updates cache timestamps for one or more source-content records.
- `retranslate({ id })`: loads the existing translation row, generates fresh text through backend `/api/translate-create-limited-anon`, updates that Supabase row's `target_text`, `created_at`, and backend-reported `translator`, then refreshes the client cache.
- `updateTranslationWithHumanEdit({ id, targetText })`: updates an existing Supabase translation row's `target_text`, `created_at`, and `translator: "USER"`, then refreshes the client cache.
- `fetchAnnotation({ localization })`: returns annotation data for a localization, using cache/Supabase/backend lookup as needed.
- `reGenOwnerAnnotation({ localization, skipDeletionOfExisting? })`: deletes and rebuilds an owner-scoped annotation, then refreshes the annotation cache.
- `reAnnotateWithExistingData(input)`: re-runs backend annotation generation from existing stored annotation data and updates the annotation cache with the returned rows.

Additional core helpers:

- `getBinderDocsByMinL10nsOrder([{ doc_id, l10ns }], { priorityDocIds? })`: calculates "learning order by minimum new words" for already-loaded binder doc localization caches.
- `fetchBinderDocsByMinL10nsOrder({ supabaseClient, binder_id, lang, priorityDocIds? })`: loads `cache_binder_doc_l10ns` rows for a binder/language pair and returns the same ordering.

The client also exposes two owned cache references for advanced callers:

- `translationsCache.current`: in-memory `TranslationRow[]` cache owned by the client instance.
- `annotationsByLangNTextCache.current`: in-memory annotation cache owned by the client instance.

## Example Usage

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

## Localization Docs & Segments

`Localization` represents a full localized document/translation/string. To annotate only part of it, use the same `Localization` shape and store segment coordinates on the DB ref:

```ts
{ db: { table: "translations", column: "target_text", id: 7, line_idx: 4, seg_idx: 1 } }
```

`line_idx` and `seg_idx` are optional and identify a `LocalizationSegment` within the larger document. Annotation helpers preserve them when creating the stored annotation ref. Omit `line_idx` and `seg_idx` when annotating the whole localization.

## Rendering Annotation in Next.js

`import { AnnotatedTextView } from "lingop/ui/next";

<AnnotatedTextView annotatedText={annotatedText} />;`

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
- `src/core/language/` contains language metadata, script metadata, localized language names, OpenAI voice metadata, and language lookup helpers. Large metadata tables live under `src/core/language/data/`.
- `src/core/lingo-data-client.ts` is the platform-neutral successor to old `LingoDataContext`. It owns annotation and translation caches and exposes localization, translation-cache, annotation, re-generation, and re-annotation methods.
- `src/core/misc.ts` contains platform-neutral utility functions ported from old `utils/misc.ts`. Browser image helpers based on `html2canvas` and element download/image capture were intentionally not ported.
- `src/core/translation/` contains platform-neutral translation types and internal table/localization helpers used by `createLingoDataClient()`.
- `src/ui/next/cookies.ts` contains browser cookie helpers separated from platform-neutral core utilities.
- `src/ui/react-native/` is reserved for React Native-specific UI helpers.
