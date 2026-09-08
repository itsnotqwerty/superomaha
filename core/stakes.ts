// Stakes — optional difficulty modifiers (scope §9: after first win only,
// never required; Challenge seeds get a shareable seed string).

import { Collection } from "./collection.ts";

export interface Stake {
  id: string;
  name: string;
  text: string;
  /** Unlock: first win opens stakes (scope §9). */
  unlock: (c: Collection) => boolean;
  /** Target multiplier applied to every blind. */
  targetMult: number;
  /** Fewer redraws everywhere. */
  redrawDelta?: number;
  /** Fewer plays everywhere. */
  playDelta?: number;
}

export const STAKES: Stake[] = [
  {
    id: "base",
    name: "Base",
    text: "The standard game.",
    unlock: () => true,
    targetMult: 1,
  },
  {
    id: "hard-hustle",
    name: "Hard Hustle",
    text: "Targets ×1.25.",
    unlock: (c) => c.wins >= 1,
    targetMult: 1.25,
  },
  {
    id: "shorthanded",
    name: "Shorthanded",
    text: "Targets ×1.25, one fewer redraw on every blind.",
    unlock: (c) => c.wins >= 1,
    targetMult: 1.25,
    redrawDelta: -1,
  },
  {
    id: "degenerate",
    name: "Degenerate",
    text: "Targets ×1.6, one fewer play on every blind.",
    unlock: (c) => c.wins >= 2,
    targetMult: 1.6,
    playDelta: -1,
  },
];

export const STAKE_REGISTRY = new Map(STAKES.map((s) => [s.id, s]));

/** Challenge seed format: challenge-<tag>?stake=<stakeId>&table=<tableId>.
 * Ids contain dashes, so they ride in a query suffix instead of the path. */
export function challengeSeed(stakeId: string, tableId: string, tag: string) {
  return `challenge-${
    encodeURIComponent(tag)
  }?stake=${stakeId}&table=${tableId}`;
}

export function parseChallenge(seed: string) {
  if (!seed.startsWith("challenge-")) return null;
  const [tagPart, queryPart] = seed.split("?");
  const tag = decodeURIComponent(tagPart.slice("challenge-".length));
  const params = new URLSearchParams(queryPart ?? "");
  return {
    stakeId: params.get("stake") ?? "base",
    tableId: params.get("table") ?? "classic",
    tag,
  };
}
