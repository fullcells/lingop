import { useEffect, useState } from "react";
import type { LingoDataClient } from "../../core/lingo-data-client.js";

/** Accepts the same shared client used by web consumers, without a web provider. */
export type AnnotatedTextEmojiClient = Pick<LingoDataClient, "generateEmojis">;

export function useGlossEmojis(
  client: AnnotatedTextEmojiClient | undefined,
  glosses: readonly string[],
) {
  // Value-based dependencies avoid refetching when an app passes inline hint
  // callbacks, or selects another word that has the same English gloss.
  const signature = JSON.stringify([...new Set(glosses.filter(Boolean))]);
  const [batch, setBatch] = useState<{
    client: AnnotatedTextEmojiClient;
    signature: string;
    results: Record<string, string | null>;
  } | null>(null);
  useEffect(() => {
    if (!client || signature === "[]") return;
    let cancelled = false;
    const requestedGlosses: string[] = JSON.parse(signature);
    void Promise.resolve().then(() => client.generateEmojis(requestedGlosses)).then(
      (results) => {
        if (!cancelled) setBatch({ client, signature, results });
      },
      (error: unknown) => {
        if (cancelled) return;
        console.warn("Unable to resolve annotation emojis:", error);
        setBatch({ client, signature, results: {} });
      },
    );
    return () => { cancelled = true; };
  }, [client, signature]);
  const results = batch?.client === client && batch?.signature === signature
    ? batch.results : null;
  return {
    results,
    loading: !!client && signature !== "[]" && results === null,
  };
}
