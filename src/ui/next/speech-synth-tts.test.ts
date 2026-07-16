import { describe, expect, it, vi } from "vitest";

import {
  fetchSpeech,
  prettifyVoiceId,
  speakableTextFromDisplayText,
  type AudioMetaRow,
  type SpeechSynthSupabaseClient,
} from "./speech-synth-tts.js";

type SpeechSupabaseSelectResult = {
  data: unknown[] | null;
  error: unknown | null;
};

type SpeechSupabaseQuery = PromiseLike<SpeechSupabaseSelectResult> & {
  eq(column: string, value: unknown): SpeechSupabaseQuery;
  ilike(column: string, value: string): SpeechSupabaseQuery;
};

const baseRow: AudioMetaRow = {
  id: 1,
  lang: "en",
  text: "hello",
  filename: "hello.mp3",
  owner_id: "owner-1",
  character_label: null,
  service: "MICROSOFT",
  voice_id: "en-US-AndrewMultilingualNeural",
  ref: { db: { table: "translations", column: "target_text", id: 1 } },
  created_at: "2026-01-01T00:00:00.000Z",
};

function makeQuery(rows: AudioMetaRow[]): SpeechSupabaseQuery {
  const filters: Array<[string, unknown, "eq" | "ilike"]> = [];

  const query: SpeechSupabaseQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value, "eq"]);
      return query;
    }),
    ilike: vi.fn((column: string, value: string) => {
      filters.push([column, value, "ilike"]);
      return query;
    }),
    then: (resolve, reject) => {
      const filteredRows = rows.filter((row) =>
        filters.every(([column, value, operator]) => {
          const rowValue = row[column as keyof AudioMetaRow];
          if (operator === "ilike") {
            return String(rowValue).toLowerCase() === String(value).toLowerCase();
          }
          return rowValue === value;
        }),
      );
      const result: SpeechSupabaseSelectResult = {
        data: filteredRows,
        error: null,
      };
      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return query;
}

function makeSupabaseClient(rows: AudioMetaRow[]): SpeechSynthSupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => makeQuery(rows)),
    })),
  };
}

describe("speech synth TTS", () => {
  it("makes display text speakable for underscore blanks", () => {
    expect(speakableTextFromDisplayText({ lang: "en", text: "I ___ know" })).toBe(
      "I hmm know",
    );
    expect(speakableTextFromDisplayText({ lang: "yue", text: "我__" })).toBe("我嗯");
  });

  it("prettifies provider voice ids", () => {
    expect(prettifyVoiceId("en-US-AndrewMultilingualNeural:DragonNeural")).toBe(
      "Andrew Multilingual Neural",
    );
  });

  it("fetches and prioritizes the closest speech row", async () => {
    const supabase = makeSupabaseClient([
      {
        ...baseRow,
        id: 1,
        text: "hello",
        voice_id: "en-US-OtherNeural",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        ...baseRow,
        id: 2,
        text: "hello",
        voice_id: "en-US-AndrewMultilingualNeural",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    await expect(
      fetchSpeech({
        lang: "en",
        ref: baseRow.ref,
        text: "hello",
        voice_id: "en-US-AndrewMultilingualNeural",
        match_on: ["text"],
        supabase,
        owner_id: "owner-1",
      }),
    ).resolves.toMatchObject({
      id: 2,
      voice_id: "en-US-AndrewMultilingualNeural",
    });
  });
});
