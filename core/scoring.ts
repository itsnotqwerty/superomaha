// ScoringPipeline (spec §5 / REQ-SCORE-1..3).
// Executes the mandatory 8-step order and emits a step list that is consumed
// verbatim by BOTH the score animation layer and the replay log — one source
// of truth, no divergence between what the player saw and what rules computed.

import { Card, cardLabel } from "./cards.ts";
import {
  baseScore,
  EvaluatedHand,
  HAND_TABLE,
  HandCategory,
} from "./evaluator.ts";
import { Modifier, ScoreContext } from "./mods.ts";

export interface ScoreStep {
  step: number;
  label: string;
  chips: number;
  mult: number;
  total: number;
}

export interface ScoreResult {
  hand: EvaluatedHand;
  steps: ScoreStep[];
  total: number;
}

/** Hand-leveler bonuses: permanent per-run +chips/+mult per hand type. */
export type HandLevels = Partial<Record<HandCategory, number>>;

export interface ScoreOptions {
  /** Active relics, in slot order. */
  relics?: Modifier[];
  /** Active boss rule, if any. */
  boss?: Modifier | null;
  /** Hand-leveler bonuses (each level: +chips = base/5 rounded, +1 mult). */
  handLevels?: HandLevels;
  hole?: Card[];
  board?: Card[];
  cash?: number;
  playsLeftAfter?: number;
  redrawsLeft?: number;
}

/**
 * Score one committed hand through the pipeline.
 * Steps 1–2 (legality, enumeration) happen in the evaluator before commit;
 * classification (3) may be demoted by the boss's recategorize hook.
 */
export function scoreHand(
  hand: EvaluatedHand,
  opts: ScoreOptions = {},
): ScoreResult {
  const steps: ScoreStep[] = [];
  const table = HAND_TABLE[hand.category];
  const level = opts.handLevels?.[hand.category] ?? 0;

  // Hand levelers: each level adds +10 chips and +1 mult (MVP tuning).
  const base = baseScore(hand);
  let chips = base.chips + level * 10;
  let mult = base.mult + level;

  const push = (step: number, label: string) => {
    steps.push({ step, label, chips, mult, total: chips * mult });
  };

  // Step 3 — classification anchor (after any boss demotion, which the
  // evaluator already applied to hand.category).
  push(
    3,
    `${
      hand.category.replaceAll("_", " ")
    } (base ${table.chips} × ${table.mult})`,
  );

  if (level > 0) {
    push(3.5, `hand level ${level} (+${level * 10} chips, +${level} mult)`);
  }

  // Step 4 — card chips detail.
  const cardChips = hand.cards.reduce((s, c) => s + Math.min(c.rank, 11), 0);
  push(4, `card chips +${cardChips} (${hand.cards.map(cardLabel).join(" ")})`);

  // Steps 5–7 — on-card modifiers (post-MVP), relic hooks in slot order,
  // then after-score triggers. Boss hooks run after relics.
  const ctx: ScoreContext = {
    hand,
    hole: opts.hole ?? [],
    board: opts.board ?? [],
    holeCards: hand.holeIdx.map((i) => (opts.hole ?? [])[i]).filter(Boolean),
    boardCards: hand.boardIdx.map((i) => (opts.board ?? [])[i]).filter(Boolean),
    unusedHole: (opts.hole ?? []).filter((_, i) => !hand.holeIdx.includes(i)),
    cash: opts.cash ?? 0,
    playsLeftAfter: opts.playsLeftAfter ?? 0,
    redrawsLeft: opts.redrawsLeft ?? 0,
  };

  const mods = [...(opts.relics ?? []), ...(opts.boss ? [opts.boss] : [])];

  // Step 6 — flat chips → +mult → ×mult, in slot order.
  for (const mod of mods) {
    const d = mod.onScore?.(ctx);
    if (!d) continue;
    if (d.flatChips) chips += d.flatChips;
    if (d.plusMult) mult += d.plusMult;
    if (d.multMult) mult *= d.multMult;
    push(6, d.note ?? mod.name);
  }

  // Step 7 — after-score triggers.
  for (const mod of mods) {
    const d = mod.onAfterScore?.(ctx);
    if (!d) continue;
    if (d.flatChips) chips += d.flatChips;
    if (d.plusMult) mult += d.plusMult;
    if (d.multMult) mult *= d.multMult;
    push(7, d.note ?? `${mod.name} (trigger)`);
  }

  // Step 8 — final total; the step list doubles as the replay log entry.
  return { hand, steps, total: chips * mult };
}

/** Legality options for the evaluator, merged from relics + boss. */
export function legalityOf(mods: Modifier[]): {
  holePick?: number;
  boardPick?: number;
  comboFilter?: (h: Card[], b: Card[]) => boolean;
  recategorize?: (c: HandCategory) => HandCategory;
  forcePick?: number;
  lowball?: boolean;
} {
  let holePick: number | undefined;
  let boardPick: number | undefined;
  let forcePick: number | undefined;
  const filters: ((h: Card[], b: Card[]) => boolean)[] = [];
  const recats: ((c: HandCategory) => HandCategory)[] = [];

  for (const m of mods) {
    if (m.shape) {
      holePick = m.shape.hole;
      boardPick = m.shape.board;
    }
    if (m.comboFilter) filters.push(m.comboFilter);
    if (m.recategorize) recats.push(m.recategorize);
    if (m.forcePick !== undefined) forcePick = m.forcePick;
  }

  return {
    holePick,
    boardPick,
    forcePick,
    comboFilter: filters.length
      ? (h, b) => filters.every((f) => f(h, b))
      : undefined,
    recategorize: recats.length
      ? (c) => recats.reduce((acc, f) => f(acc), c)
      : undefined,
  };
}
