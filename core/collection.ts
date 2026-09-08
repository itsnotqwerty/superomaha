// Meta progression (spec §11 / REQ-META-2): the collection tracks seen
// relics, bosses, and tables across runs. Discovery in-run, never gated.

export interface Collection {
  relics: string[];
  bosses: string[];
  tables: string[];
  wins: number;
  runs: number;
  bestAnte: number;
}

export const EMPTY_COLLECTION: Collection = {
  relics: [],
  bosses: [],
  tables: [],
  wins: 0,
  runs: 0,
  bestAnte: 0,
};

const KEY = "super-omaha/collection/v1";

export function collectionKey(): string {
  return KEY;
}

export function loadCollection(raw: string | null): Collection {
  if (!raw) return { ...EMPTY_COLLECTION };
  try {
    const c = JSON.parse(raw);
    return { ...EMPTY_COLLECTION, ...c };
  } catch {
    return { ...EMPTY_COLLECTION };
  }
}

/** Merge run-seen content into the collection (returns a new object). */
export function recordRun(
  c: Collection,
  seen: {
    relicIds: string[];
    bossIds: string[];
    tableId: string;
    ante: number;
    won: boolean;
  },
): Collection {
  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
  return {
    relics: union(c.relics, seen.relicIds),
    bosses: union(c.bosses, seen.bossIds),
    tables: union(c.tables, [seen.tableId]),
    wins: c.wins + (seen.won ? 1 : 0),
    runs: c.runs + 1,
    bestAnte: Math.max(c.bestAnte, seen.ante),
  };
}
