// Omaha hand evaluator (spec §2, §5).
// INVARIANT: a legal scored hand is exactly 2 hole cards + exactly 3 board cards.
// Enumerates C(4,2) × C(5,3) = 60 combos and classifies each.

import { Card, Rank } from "./cards.ts";

export type HandCategory =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush";

export const CATEGORY_ORDER: HandCategory[] = [
  "high_card",
  "pair",
  "two_pair",
  "three_of_a_kind",
  "straight",
  "flush",
  "full_house",
  "four_of_a_kind",
  "straight_flush",
];

// MVP scoring table (spec REQ-SCORE-4; tuning values, not final balance).
export const HAND_TABLE: Record<HandCategory, { chips: number; mult: number }> =
  {
    high_card: { chips: 5, mult: 1 },
    pair: { chips: 10, mult: 2 },
    two_pair: { chips: 20, mult: 2 },
    three_of_a_kind: { chips: 30, mult: 3 },
    straight: { chips: 30, mult: 4 },
    flush: { chips: 35, mult: 4 },
    full_house: { chips: 40, mult: 4 },
    four_of_a_kind: { chips: 60, mult: 7 },
    straight_flush: { chips: 100, mult: 8 },
  };

export interface EvaluatedHand {
  category: HandCategory;
  /** The scoring cards (hole picks + board picks). */
  cards: Card[];
  /** Tiebreak ranks, most significant first (kickers among the scored cards). */
  tiebreak: number[];
  /** @deprecated use holeIdx — kept for the classic 2-pick shape. */
  holePair: [number, number];
  /** @deprecated use boardIdx — kept for the classic 3-pick shape. */
  boardTrip: [number, number, number];
  /** Indices into the hole array (length = holePick). */
  holeIdx: number[];
  /** Indices into the board array (length = boardPick). */
  boardIdx: number[];
}

function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  (function go(start: number) {
    if (cur.length === k) return out.push([...cur]);
    for (let i = start; i <= n - (k - cur.length); i++) {
      cur.push(i);
      go(i + 1);
      cur.pop();
    }
  })(0);
  return out;
}

/** All hole-pair / board-triple index combos (6 × 10 = 60). */
export function legalCombos(
  holeSize = 4,
  boardSize = 5,
): { pair: [number, number]; trip: [number, number, number] }[] {
  const pairs = combinations(holeSize, 2) as [number, number][];
  const trips = combinations(boardSize, 3) as [number, number, number][];
  const out: { pair: [number, number]; trip: [number, number, number] }[] = [];
  for (const pair of pairs) for (const trip of trips) out.push({ pair, trip });
  return out;
}

/** Classify one 5-card hand. Ranks are 2..14 (Ace high). */
export function classifyFive(
  cards: Card[],
): { category: HandCategory; tiebreak: number[] } {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);

  const counts = new Map<Rank, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // groups sorted by count desc, then rank desc
  const groups = [...counts.entries()].sort((a, b) =>
    b[1] - a[1] || b[0] - a[0]
  );

  const straightHigh = findStraightHigh([...counts.keys()]);
  const straight = straightHigh !== null;

  let category: HandCategory;
  if (straight && flush) category = "straight_flush";
  else if (groups[0][1] === 4) category = "four_of_a_kind";
  else if (groups[0][1] === 3 && groups[1]?.[1] === 2) category = "full_house";
  else if (flush) category = "flush";
  else if (straight) category = "straight";
  else if (groups[0][1] === 3) category = "three_of_a_kind";
  else if (groups[0][1] === 2 && groups[1]?.[1] === 2) category = "two_pair";
  else if (groups[0][1] === 2) category = "pair";
  else category = "high_card";

  let tiebreak: number[];
  switch (category) {
    case "straight":
    case "straight_flush":
      tiebreak = [straightHigh as number];
      break;
    case "four_of_a_kind":
      tiebreak = [groups[0][0], groups[1][0]];
      break;
    case "full_house":
      tiebreak = [groups[0][0], groups[1][0]];
      break;
    case "three_of_a_kind":
      tiebreak = [
        groups[0][0],
        ...groups.slice(1).map((g) => g[0]).sort((a, b) => b - a),
      ];
      break;
    case "two_pair":
      tiebreak = [
        ...groups.slice(0, 2).map((g) => g[0]).sort((a, b) => b - a),
        groups[2][0],
      ];
      break;
    case "pair":
      tiebreak = [
        groups[0][0],
        ...groups.slice(1).map((g) => g[0]).sort((a, b) => b - a),
      ];
      break;
    default:
      // flush / high_card: descending ranks; wheel flush ranks normally
      tiebreak = ranks;
  }
  return { category, tiebreak };
}

/**
 * Lowball (2-7) classification: pairs hurt, straights/flushes are ignored as
 * patterns (they count only by rank), and the LOWEST hand wins. Category is
 * "high_card" for any unpaired hand; pairs+ are penalized via category order.
 */
export function classifyFiveLowball(
  cards: Card[],
): { category: HandCategory; tiebreak: number[] } {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b); // ascending
  const counts = new Map<Rank, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) =>
    b[1] - a[1] || a[0] - b[0]
  );

  let category: HandCategory;
  if (groups[0][1] === 4) category = "four_of_a_kind";
  else if (groups[0][1] === 3 && groups[1]?.[1] === 2) category = "full_house";
  else if (groups[0][1] === 3) category = "three_of_a_kind";
  else if (groups[0][1] === 2 && groups[1]?.[1] === 2) category = "two_pair";
  else if (groups[0][1] === 2) category = "pair";
  else category = "high_card";

  // Tiebreaks ascend (lowest cards first) — the comparator is inverted by
  // the caller so the lowest hand ranks "best".
  return { category, tiebreak: ranks };
}

/**
 * Highest card of the best 5-card straight present in the rank set,
 * or null. Handles the wheel (A-2-3-4-5 → high card 5) and rejects
 * wrap straights (Q-K-A-2-3 is NOT a straight).
 */
export function findStraightHigh(ranks: Rank[]): number | null {
  const set = new Set(ranks);
  for (let high = 14; high >= 5; high--) {
    let ok = true;
    for (let r = high; r > high - 5; r--) {
      if (!set.has(r)) {
        ok = false;
        break;
      }
    }
    if (ok) return high;
  }
  // Wheel: A,2,3,4,5 → straight with high card 5
  if (set.has(14) && set.has(2) && set.has(3) && set.has(4) && set.has(5)) {
    return 5;
  }
  return null;
}

/** Compare two evaluated hands: negative if a < b, 0 tie, positive if a > b. */
export function compareHands(
  a: Pick<EvaluatedHand, "category" | "tiebreak">,
  b: Pick<EvaluatedHand, "category" | "tiebreak">,
): number {
  const ca = CATEGORY_ORDER.indexOf(a.category);
  const cb = CATEGORY_ORDER.indexOf(b.category);
  if (ca !== cb) return ca - cb;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const d = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Evaluate every legal 2+3 combo; returns all, sorted best-first. */
export function evaluateOmaha(hole: Card[], board: Card[]): EvaluatedHand[] {
  return evaluate(hole, board);
}

export interface EvaluateOptions {
  /** Legal shape override (default 2 hole + 3 board). */
  holePick?: number;
  boardPick?: number;
  /** Veto combos (legality modifiers run BEFORE enumeration filtering). */
  comboFilter?: (holeCards: Card[], boardCards: Card[]) => boolean;
  /** Demote/replace classifications (e.g. boss "no flushes score"). */
  recategorize?: (category: HandCategory) => HandCategory;
  /** Lowball (2-7): lowest hand wins; straights/flushes don't count. */
  lowball?: boolean;
  /** Wild board seats (indices into board): each counts as its best
   * rank/suit per combo (scope §8.4 wild-board). */
  wildSeats?: number[];
}

/**
 * Generalized evaluator: enumerates C(hole, holePick) × C(board, boardPick),
 * applies legality filters and recategorization. The Omaha 2+3 invariant is
 * the default shape; only modifiers may change it.
 */
export function evaluate(
  hole: Card[],
  board: Card[],
  opts: EvaluateOptions = {},
): EvaluatedHand[] {
  const holePick = opts.holePick ?? 2;
  const boardPick = opts.boardPick ?? 3;
  const results: EvaluatedHand[] = [];
  if (hole.length < holePick || board.length < boardPick) return [];
  const holeCombos = combinations(hole.length, holePick);
  const boardCombos = combinations(board.length, boardPick);
  for (const hp of holeCombos) {
    for (const bt of boardCombos) {
      const holeCards = hp.map((i) => hole[i]);
      const boardCards = bt.map((i) => board[i]);
      if (opts.comboFilter && !opts.comboFilter(holeCards, boardCards)) {
        continue;
      }
      const cards = [...holeCards, ...boardCards];
      // Wild seats: evaluate each rank assignment and keep the best result.
      const wildPositions: number[] = [];
      for (const [pos, boardIndex] of bt.entries()) {
        if (opts.wildSeats?.includes(boardIndex)) wildPositions.push(pos);
      }
      let bestEval: { category: HandCategory; tiebreak: number[] } | null = null;
      if (wildPositions.length > 0) {
        for (let r = 2; r <= 14; r++) {
          const trial = [...cards];
          for (const pos of wildPositions) {
            trial[holePick + pos] = { rank: r, suit: trial[holePick + pos].suit };
          }
          const ev = opts.lowball
            ? classifyFiveLowball(trial)
            : classifyFive(trial);
          if (
            !bestEval ||
            (opts.lowball
              ? compareLowball(ev, bestEval) < 0
              : compareHands(ev, bestEval) > 0)
          ) {
            bestEval = ev;
          }
        }
      }
      let { category, tiebreak } = bestEval ?? (opts.lowball
        ? classifyFiveLowball(cards)
        : classifyFive(cards));
      if (opts.recategorize) {
        const recat = opts.recategorize(category);
        if (recat !== category) {
          // Demoted hands keep their cards but rank as the new category;
          // tiebreaks fall back to plain descending ranks.
          category = recat;
          tiebreak = cards.map((c) => c.rank).sort((a, b) => b - a);
        }
      }
      results.push({
        category,
        cards,
        tiebreak,
        holePair: [hp[0] ?? -1, hp[1] ?? -1],
        boardTrip: [bt[0] ?? -1, bt[1] ?? -1, bt[2] ?? -1],
        holeIdx: hp,
        boardIdx: bt,
      });
    }
  }
  if (opts.lowball) {
    // Lowest hand first: invert category order and tiebreak direction.
    results.sort((a, b) => compareLowball(a, b));
  } else {
    results.sort((a, b) => compareHands(b, a));
  }
  return results;
}

/** Lowball comparison: fewer/no pairs first, then lowest cards win. */
export function compareLowball(
  a: Pick<EvaluatedHand, "category" | "tiebreak">,
  b: Pick<EvaluatedHand, "category" | "tiebreak">,
): number {
  const ca = CATEGORY_ORDER.indexOf(a.category);
  const cb = CATEGORY_ORDER.indexOf(b.category);
  if (ca !== cb) return ca - cb;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const d = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Best legal combo per hole pair (drives the six pair tabs). */
export function bestByHolePair(
  hole: Card[],
  board: Card[],
  opts: EvaluateOptions = {},
): Map<string, EvaluatedHand> {
  const best = new Map<string, EvaluatedHand>();
  for (const h of evaluate(hole, board, opts)) {
    const key = h.holeIdx.join(",");
    if (!best.has(key)) best.set(key, h); // results are sorted best-first
  }
  return best;
}

/** Per-combo score for the committed hand (spec §6.1 base term). */
export function baseScore(
  hand: EvaluatedHand,
): { chips: number; mult: number } {
  const t = HAND_TABLE[hand.category];
  const cardChips = hand.cards.reduce((s, c) => s + Math.min(c.rank, 11), 0); // A/J/Q/K count as 11
  return { chips: t.chips + cardChips, mult: t.mult };
}
