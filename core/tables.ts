// Starting tables (spec REQ-CONTENT-3). Unlocked by play, never cash.
// A table is data: deck ranks + play/redraw budget + redraw scope.

import { defaultRanks, Rank, shortDeckRanks } from "./cards.ts";

export interface TableConfig {
  id: string;
  name: string;
  text: string;
  ranks: () => Rank[];
  plays: number;
  redraws: number;
  /** Bonus cash per blind won (Naked Board pays extra). */
  bonusPayout?: number;
  /** Target multiplier (hotter decks need hotter targets). */
  targetMult?: number;
  /** Deal holes as two suited pairs (Double-Suited). */
  doubleSuited?: boolean;
  /** Reveal the board flop → turn → river between plays. */
  streets?: boolean;
  /** Hole size (Five-Card Omaha: 5; still exactly 2 hole per hand). */
  holeSize?: number;
  /** Lowball (2-7): lowest hand scores best (strategies invert). */
  lowball?: boolean;
  /** One random board card per deal is wild (counts as its best rank). */
  wildBoard?: boolean;
}

export const TABLES: TableConfig[] = [
  {
    id: "classic",
    name: "Classic",
    text: "52 cards, 3 plays, 2 redraws. The standard game.",
    ranks: defaultRanks,
    plays: 3,
    redraws: 2,
  },
  {
    id: "double-suited",
    name: "Double-Suited",
    text:
      "Hole deals as two suited pairs (like a double-suited PLO hand), but only 1 redraw.",
    ranks: defaultRanks,
    plays: 3,
    redraws: 1,
    doubleSuited: true,
  },
  {
    id: "short-deck",
    name: "Short Deck",
    text: "36 cards (6+). Hotter hands, higher targets.",
    ranks: shortDeckRanks,
    plays: 3,
    redraws: 2,
    targetMult: 1.6,
  },
  {
    id: "naked-board",
    name: "Naked Board",
    text:
      "Streets reveal one at a time (flop → turn → river), 1 redraw, but blinds pay +$2.",
    ranks: defaultRanks,
    plays: 3,
    redraws: 1,
    bonusPayout: 2,
    streets: true,
  },
  {
    id: "five-card",
    name: "Five-Card Omaha",
    text:
      "5 hole cards, still exactly 2 per hand. More combos, hotter targets.",
    ranks: defaultRanks,
    plays: 3,
    redraws: 2,
    holeSize: 5,
    targetMult: 1.5,
  },
  {
    id: "lowball",
    name: "Lowball (2-7)",
    text:
      "Lowest hand wins. Pairs are bad, aces are high. Flushes and straights don't count.",
    ranks: defaultRanks,
    plays: 3,
    redraws: 2,
    lowball: true,
  },
  {
    id: "wild-board",
    name: "Wild Board",
    text: "One board card per deal is wild — it counts as its best rank.",
    ranks: defaultRanks,
    plays: 3,
    redraws: 2,
    wildBoard: true,
    targetMult: 1.3,
  },
];

export const TABLE_REGISTRY = new Map(TABLES.map((t) => [t.id, t]));

export const DEFAULT_TABLE = TABLES[0];
