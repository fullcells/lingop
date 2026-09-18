import {
  asSupabaseRuntimeClient,
  type SupabaseClientLike,
  type SupabaseRuntimeClient,
} from "./supabase.js";

export type HancharComponentRole = "semantic" | "phonetic" | "structural";

export type HancharReading = {
  lang: string;
  reading: string;
  readingType: string | null;
  source: string | null;
};

export type HancharComponent = {
  literal: string;
  enGloss: string | null;
  decomposition: string | null;
  readings: HancharReading[];
  ordinal: number;
  role: HancharComponentRole;
  source: string | null;
  components: HancharComponent[];
};

export type HancharDecomposition = {
  literal: string;
  enGloss: string | null;
  decomposition: string | null;
  components: HancharComponent[];
  readings: HancharReading[];
};

type HancharRow = {
  id: number;
  literal: string;
  en_gloss: string | null;
  decomposition: string | null;
};
type HancharComponentRow = {
  id: number;
  component_hanchar_id: number;
  parent_hanchar_component_id: number | null;
  ordinal: number;
  role: HancharComponentRole | null;
  source: string | null;
};
type HancharReadingRow = {
  hanchar_id: number;
  lang: string;
  reading: string;
  reading_type: string | null;
  source: string | null;
};

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return JSON.stringify(error);
}

function isHancharRow(value: unknown): value is HancharRow {
  return !!value && typeof value === "object" &&
    typeof (value as HancharRow).id === "number" &&
    typeof (value as HancharRow).literal === "string" &&
    ((value as HancharRow).en_gloss === null ||
      typeof (value as HancharRow).en_gloss === "string") &&
    ((value as HancharRow).decomposition === null ||
      typeof (value as HancharRow).decomposition === "string");
}

function isComponentRow(value: unknown): value is HancharComponentRow {
  if (!value || typeof value !== "object") return false;
  const row = value as HancharComponentRow;
  return typeof row.id === "number" &&
    typeof row.component_hanchar_id === "number" &&
    (row.parent_hanchar_component_id === null ||
      typeof row.parent_hanchar_component_id === "number") &&
    typeof row.ordinal === "number" &&
    (row.role === null || row.role === "semantic" || row.role === "phonetic" ||
      row.role === "structural") &&
    (row.source === null || typeof row.source === "string");
}

function isReadingRow(value: unknown): value is HancharReadingRow {
  if (!value || typeof value !== "object") return false;
  const row = value as HancharReadingRow;
  return typeof row.hanchar_id === "number" &&
    typeof row.lang === "string" && typeof row.reading === "string" &&
    (row.reading_type === null || typeof row.reading_type === "string") &&
    (row.source === null || typeof row.source === "string");
}

/** Loads one canonical decomposition tree and its available readings. */
export async function getHancharDecomposition(
  literal: string,
  { supabaseClient }: { supabaseClient?: SupabaseClientLike } = {},
): Promise<HancharDecomposition | null> {
  const normalizedLiteral = literal.trim();
  if (Array.from(normalizedLiteral).length !== 1) {
    console.error("getHancharDecomposition requires exactly one Unicode character.");
    return null;
  }

  const client = asSupabaseRuntimeClient(supabaseClient);
  if (!client) {
    console.error("getHancharDecomposition requires a Supabase client.");
    return null;
  }

  return loadHancharDecomposition(
    normalizedLiteral,
    client,
    new Set<string>(),
    new Map<string, HancharDecomposition | null>(),
  );
}

async function loadHancharDecomposition(
  literal: string,
  client: SupabaseRuntimeClient,
  ancestors: ReadonlySet<string>,
  cache: Map<string, HancharDecomposition | null>,
): Promise<HancharDecomposition | null> {
  // Malformed source data must not make the recursive component lookup loop.
  if (ancestors.has(literal)) return null;

  if (cache.has(literal)) return cache.get(literal) ?? null;

  const result = await (async (): Promise<HancharDecomposition | null> => {
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(literal);

    const hancharResult = await client
      .from("hanchars")
      .select("id, literal, en_gloss, decomposition")
      .eq("literal", literal);
    if (hancharResult.error) {
      console.error("Supabase hanchars select error:", errorMessage(hancharResult.error));
      return null;
    }

    const hanchar = Array.isArray(hancharResult.data)
      ? hancharResult.data.find(isHancharRow)
      : undefined;
    if (!hanchar) return null;

    const componentsResult = await client
      .from("hanchar_components")
      .select(
        "id, component_hanchar_id, parent_hanchar_component_id, ordinal, role, source",
      )
      .eq("hanchar_id", hanchar.id)
      .order("ordinal", { ascending: true });

    if (componentsResult.error) {
      console.error(
        "Supabase hanchar detail select error:",
        errorMessage(componentsResult.error),
      );
      return null;
    }

    const componentRows = Array.isArray(componentsResult.data)
      ? componentsResult.data.filter(isComponentRow)
      : [];
    const componentHancharIds = [
      ...new Set(componentRows.map((row) => row.component_hanchar_id)),
    ];
    const hancharsById = new Map<number, HancharRow>([[hanchar.id, hanchar]]);
    const readingsByHancharId = new Map<number, HancharReading[]>();
    const detailHancharIds = [hanchar.id, ...componentHancharIds];

    const [componentHancharsResult, readingsResult] = await Promise.all([
      componentHancharIds.length > 0
        ? client
          .from("hanchars")
          .select("id, literal, en_gloss, decomposition")
          .in("id", componentHancharIds)
        : Promise.resolve({ data: [], error: null }),
      client
        .from("hanchar_readings")
        .select("hanchar_id, lang, reading, reading_type, source")
        .in("hanchar_id", detailHancharIds)
        .order("lang", { ascending: true }),
    ]);

    if (componentHancharsResult.error || readingsResult.error) {
      console.error(
        "Supabase component hanchar detail select error:",
        errorMessage(componentHancharsResult.error ?? readingsResult.error),
      );
      return null;
    }

    for (const row of Array.isArray(componentHancharsResult.data)
      ? componentHancharsResult.data
      : []) {
      if (isHancharRow(row)) hancharsById.set(row.id, row);
    }
    for (const row of Array.isArray(readingsResult.data)
      ? readingsResult.data.filter(isReadingRow)
      : []) {
      const readings = readingsByHancharId.get(row.hanchar_id) ?? [];
      readings.push({
        lang: row.lang,
        reading: row.reading,
        readingType: row.reading_type,
        source: row.source,
      });
      readingsByHancharId.set(row.hanchar_id, readings);
    }

    const componentsById = new Map<number, HancharComponent>();
    for (const row of componentRows) {
      const componentHanchar = hancharsById.get(row.component_hanchar_id);
      if (!componentHanchar) continue;
      componentsById.set(row.id, {
        literal: componentHanchar.literal,
        enGloss: componentHanchar.en_gloss,
        decomposition: componentHanchar.decomposition,
        readings: readingsByHancharId.get(componentHanchar.id) ?? [],
        ordinal: row.ordinal,
        role: row.role ?? "structural",
        source: row.source,
        components: [],
      });
    }

    const rootComponents: HancharComponent[] = [];
    for (const row of componentRows) {
      const component = componentsById.get(row.id);
      if (!component) continue;
      const parent = row.parent_hanchar_component_id === null
        ? undefined
        : componentsById.get(row.parent_hanchar_component_id);
      if (parent) parent.components.push(component);
      else rootComponents.push(component);
    }

    const sortComponents = (components: HancharComponent[]): void => {
      components.sort((left, right) => left.ordinal - right.ordinal);
      for (const component of components) sortComponents(component.components);
    };
    sortComponents(rootComponents);

    // The prefill stores each character's decomposition canonically under that
    // character. Follow those records so a component such as 苗 can expose 艹
    // and 田 even though those rows are not duplicated under 貓.
    await Promise.all(
      [...componentsById.values()].map(async (component) => {
        if (component.components.length > 0) return;
        const nested = await loadHancharDecomposition(
          component.literal,
          client,
          nextAncestors,
          cache,
        );
        if (nested?.components.length) component.components = nested.components;
        if (nested) component.decomposition = nested.decomposition;
      }),
    );

    return {
      literal: hanchar.literal,
      enGloss: hanchar.en_gloss,
      decomposition: hanchar.decomposition,
      components: rootComponents,
      readings: readingsByHancharId.get(hanchar.id) ?? [],
    };
  })();

  cache.set(literal, result);
  return result;
}
