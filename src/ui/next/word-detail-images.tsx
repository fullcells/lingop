"use client";

import { useEffect, useState } from "react";
import { createImageClient, getImageFileURL, type ImageFile } from "../../core/images.js";
import { useLingopClientData } from "./lingop-client-data-provider.js";

// Keep the image client's existing 30-second cache across popover openings,
// isolated by the consumer's Supabase client. No second metadata cache.
const clients = new WeakMap<object, ReturnType<typeof createImageClient>>();
type Preview = { file: ImageFile; url: string };

/** Optional, read-only images for the exact word and language being inspected. */
export function WordDetailImages({ word, lang }: { word: string; lang: string }) {
  const { supabaseClient } = useLingopClientData();
  const key = JSON.stringify([lang, word]);
  const [result, setResult] = useState<{ key: string; db: unknown; images: Preview[] } | null>(null);

  useEffect(() => {
    let active = true;
    setResult(null);
    if (!word || !lang || !supabaseClient || typeof supabaseClient !== "object") return;
    void (async () => {
      let client = clients.get(supabaseClient);
      if (!client) {
        client = createImageClient({ supabaseClient });
        clients.set(supabaseClient, client);
      }
      const sets = await client.findWordImageSets(lang, [word]);
      if (!active || !sets.length) return;
      const files = await client.getImageFiles(sets.map(set => set.id));
      const images = files.flatMap(file => {
        if (file.is_archived) return [];
        try { return [{ file, url: getImageFileURL(file) }]; }
        catch { return []; } // A malformed file must not hide other images or details.
      });
      if (active) setResult({ key, db: supabaseClient, images });
    })().catch(() => { /* Images are optional; word details remain usable offline. */ });
    return () => { active = false; };
  }, [supabaseClient, key, word, lang]);

  if (result?.key !== key || result.db !== supabaseClient || !result.images.length) return null;
  return <div className="lingop-word-detail__images" role="group" aria-label={word} tabIndex={0}>
    {result.images.map(({ file, url }) => <figure key={file.id}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={word} lang={lang} width={112} height={112} loading="lazy" decoding="async"
          onError={() => setResult(current => current?.key === key && current.db === supabaseClient
            ? { ...current, images: current.images.filter(image => image.file.id !== file.id) } : current)} />
      </a>
      {!file.is_ai && <figcaption>
        <Credit value={file.attribution.title} />
        <Credit value={file.attribution.artist} url={file.attribution.source_url} />
        <Credit value={file.attribution.adaptation_license ?? file.attribution.license}
          url={file.attribution.adaptation_license_url ?? file.attribution.license_url} />
        <Credit value={file.attribution.modifications} />
      </figcaption>}
    </figure>)}
  </div>;
}

function Credit({ value, url }: { value: unknown; url?: unknown }) {
  if (typeof value !== "string" || !value.trim()) return null;
  let href: string | undefined;
  try {
    const parsed = typeof url === "string" ? new URL(url) : null;
    if (parsed && ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password) href = parsed.href;
  } catch { /* Keep invalid attribution URLs as plain text. */ }
  return <span>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value}</span>;
}
