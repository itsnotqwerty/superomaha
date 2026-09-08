// Shared Modifier interface (design §3.5). Relics and boss rules implement the
// same hook surface; provenance differs. All hooks are pure and deterministic.
//
// Pipeline order (spec REQ-SCORE-1):
//   1. legality: shape + comboFilter (before enumeration)
//   2–3. enumerate + classify (evaluator)
//   3b. recategorize (boss "no flushes" etc.)
//   4. card chips
//   6. onScore in slot order (flat chips → +mult → ×mult)
//   7. onAfterScore triggers
//   8. replay log

import { Card } from "./cards.ts";
import { EvaluatedHand, HandCategory } from "./evaluator.ts";

export interface ComboShape {
  hole: number; // hole cards per play (default 2)
  board: number; // board cards per play (default 3)
}

export interface ScoreContext {
  hand: EvaluatedHand;
  hole: Card[];
  board: Card[];
  /** Committed hole cards (the hand's hole picks, resolved). */
  holeCards: Card[];
  /** Committed board cards. */
  boardCards: Card[];
  /** Hole cards NOT used in the committed hand. */
  unusedHole: Card[];
  cash: number;
  playsLeftAfter: number;
  redrawsLeft: number;
}

export interface ScoreDelta {
  flatChips?: number;
  plusMult?: number;
  multMult?: number;
  note?: string; // shown in the score equation / replay log
}

/** Immediate effect when a street is revealed (streets mode only). */
export interface StreetDelta {
  score?: number; // blind score bump
  redraws?: number; // grant a redraw
  note?: string;
}

export interface Modifier {
  id: string;
  name: string;
  text: string; // one sentence
  example: string; // one example (spec REQ-CONTENT-1)

  /** Step 1: rewrite the legal shape (default 2+3). */
  shape?: ComboShape;
  /** Step 1: veto specific combos (e.g. boss: hole cards must share a suit). */
  comboFilter?: (holeCards: Card[], boardCards: Card[]) => boolean;
  /** Step 3b: demote/replace a classification (e.g. "no flushes score"). */
  recategorize?: (category: HandCategory) => HandCategory;
  /** Force which ranked hand must be committed (0=best; boss "runner-up" = 1). */
  forcePick?: number;
  /** Step 6: score modification, applied in relic slot order. */
  onScore?: (ctx: ScoreContext) => ScoreDelta | null;
  /** Step 7: after-score trigger. */
  onAfterScore?: (ctx: ScoreContext) => ScoreDelta | null;
  /** Streets mode: fired when the turn or river is revealed. */
  onStreet?: (
    street: "flop" | "turn" | "river",
    board: Card[],
  ) => StreetDelta | null;
  /** UI flags. */
  hideHole?: boolean;
  /** Board size override at deal time (boss "short board"). */
  boardSize?: number;
  /** Plays/redraws overrides at blind start. */
  plays?: number;
  redraws?: number;
}
