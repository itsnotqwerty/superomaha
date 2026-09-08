// Golden tests for the Omaha evaluator (scope §13.6 — launch blockers).
import { assertEquals, assertNotEquals } from "jsr:@std/assert@^1";
import {
  baseScore,
  bestByHolePair,
  classifyFive,
  compareHands,
  evaluateOmaha,
  findStraightHigh,
  legalCombos,
} from "./evaluator.ts";
import { Card, Rank, Suit } from "./cards.ts";
import { Rng } from "./rng.ts";
import { makeDeck } from "./cards.ts";

function c(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

Deno.test("legalCombos enumerates C(4,2) × C(5,3) = 60", () => {
  const combos = legalCombos(4, 5);
  assertEquals(combos.length, 60);
  const keys = new Set(combos.map((x) => `${x.pair}|${x.trip}`));
  assertEquals(keys.size, 60); // all unique
});

Deno.test("wheel straight A-2-3-4-5 classifies as straight with high 5", () => {
  const { category, tiebreak } = classifyFive([
    c(14, "spades"),
    c(2, "hearts"),
    c(3, "clubs"),
    c(4, "diamonds"),
    c(5, "spades"),
  ]);
  assertEquals(category, "straight");
  assertEquals(tiebreak, [5]);
});

Deno.test("wrap straight Q-K-A-2-3 is NOT a straight", () => {
  assertEquals(findStraightHigh([12, 13, 14, 2, 3]), null);
  const { category } = classifyFive([
    c(12, "spades"),
    c(13, "hearts"),
    c(14, "clubs"),
    c(2, "diamonds"),
    c(3, "spades"),
  ]);
  assertEquals(category, "high_card");
});

Deno.test("broadway straight beats wheel straight", () => {
  const broadway = classifyFive([
    c(10, "spades"),
    c(11, "hearts"),
    c(12, "clubs"),
    c(13, "diamonds"),
    c(14, "spades"),
  ]);
  const wheel = classifyFive([
    c(14, "spades"),
    c(2, "hearts"),
    c(3, "clubs"),
    c(4, "diamonds"),
    c(5, "spades"),
  ]);
  assertEquals(compareHands(broadway, wheel) > 0, true);
});

Deno.test("flush + pair is a full house, not a flush", () => {
  const { category } = classifyFive([
    c(9, "hearts"),
    c(9, "hearts"),
    c(9, "hearts"),
    c(4, "hearts"),
    c(4, "hearts"),
  ]);
  assertEquals(category, "full_house");
});

Deno.test("board-paired quads with 2 hole kickers", () => {
  // Hole: K♠ K♥ · Board: K♦ K♣ 9♠ 9♥ 2♦ → best legal = K♠K♥ + K♦K♣9♠ = quads, kicker 9
  const hole = [
    c(13, "spades"),
    c(13, "hearts"),
    c(3, "clubs"),
    c(4, "diamonds"),
  ];
  const board = [
    c(13, "diamonds"),
    c(13, "clubs"),
    c(9, "spades"),
    c(9, "hearts"),
    c(2, "diamonds"),
  ];
  const [best] = evaluateOmaha(hole, board);
  assertEquals(best.category, "four_of_a_kind");
  assertEquals(best.tiebreak, [13, 9]);
});

Deno.test("2+3 trap: board flush alone is NOT a flush", () => {
  // Board has 5 spades; hole cards are all non-spades → no legal flush exists.
  const hole = [
    c(14, "hearts"),
    c(13, "diamonds"),
    c(7, "clubs"),
    c(4, "hearts"),
  ];
  const board = [
    c(14, "spades"),
    c(11, "spades"),
    c(8, "spades"),
    c(5, "spades"),
    c(2, "spades"),
  ];
  const results = evaluateOmaha(hole, board);
  const flushes = results.filter((r) =>
    r.category === "flush" || r.category === "straight_flush"
  );
  assertEquals(flushes.length, 0);
});

Deno.test("2+3 trap: flush exists only when two hole cards suit it", () => {
  const hole = [c(14, "spades"), c(9, "spades"), c(7, "clubs"), c(4, "hearts")];
  const board = [
    c(11, "spades"),
    c(8, "spades"),
    c(5, "spades"),
    c(2, "diamonds"),
    c(2, "clubs"),
  ];
  const [best] = evaluateOmaha(hole, board);
  assertEquals(best.category, "flush");
  assertEquals(best.tiebreak[0], 14); // ace-high flush
});

Deno.test("one hole card + four board is illegal (never enumerated)", () => {
  // Hole: A♠ — if 1+4 were legal, A♠ + board would make a royal-ish flush.
  const hole = [
    c(14, "spades"),
    c(2, "hearts"),
    c(3, "diamonds"),
    c(4, "clubs"),
  ];
  const board = [
    c(13, "spades"),
    c(12, "spades"),
    c(11, "spades"),
    c(10, "spades"),
    c(9, "hearts"),
  ];
  const results = evaluateOmaha(hole, board);
  const royal = results.filter((r) =>
    r.category === "straight_flush" && r.tiebreak[0] === 14
  );
  assertEquals(royal.length, 0); // A♠ alone can never be used
});

Deno.test("bestByHolePair covers all six pairs", () => {
  const hole = [
    c(14, "hearts"),
    c(14, "diamonds"),
    c(7, "spades"),
    c(6, "spades"),
  ];
  const board = [
    c(14, "spades"),
    c(13, "spades"),
    c(9, "hearts"),
    c(4, "clubs"),
    c(2, "diamonds"),
  ];
  const byPair = bestByHolePair(hole, board);
  assertEquals(byPair.size, 6);
  // The aces pair (indices 0,1) should win overall: trip aces.
  assertEquals(byPair.get("0,1")?.category, "three_of_a_kind");
});

Deno.test("canonical tutorial example: pair of aces is not automatic", () => {
  // Board: A♠ K♠ 9♥ 4♣ 2♦ · Hole: A♥ A♦ 7♠ 6♠ (scope §10.1)
  const hole = [
    c(14, "hearts"),
    c(14, "diamonds"),
    c(7, "spades"),
    c(6, "spades"),
  ];
  const board = [
    c(14, "spades"),
    c(13, "spades"),
    c(9, "hearts"),
    c(4, "clubs"),
    c(2, "diamonds"),
  ];
  const [best] = evaluateOmaha(hole, board);
  // Best is trip aces via A♥A♦ — but A♥7♠ etc. are weaker pairs.
  assertEquals(best.category, "three_of_a_kind");
  assertEquals(best.holePair, [0, 1]);
});

Deno.test("kickers break pair ties correctly", () => {
  const a = classifyFive([
    c(8, "spades"),
    c(8, "hearts"),
    c(14, "clubs"),
    c(5, "diamonds"),
    c(3, "spades"),
  ]);
  const b = classifyFive([
    c(8, "clubs"),
    c(8, "diamonds"),
    c(13, "spades"),
    c(5, "hearts"),
    c(3, "clubs"),
  ]);
  assertEquals(a.category, "pair");
  assertEquals(compareHands(a, b) > 0, true); // ace kicker beats king kicker
});

Deno.test("baseScore uses MVP hand table", () => {
  const sf = classifyFive([
    c(10, "spades"),
    c(11, "spades"),
    c(12, "spades"),
    c(13, "spades"),
    c(14, "spades"),
  ]);
  assertEquals(sf.category, "straight_flush");
  const hand = {
    ...sf,
    cards: [
      c(10, "spades"),
      c(11, "spades"),
      c(12, "spades"),
      c(13, "spades"),
      c(14, "spades"),
    ],
    holePair: [0, 1] as [number, number],
    boardTrip: [2, 3, 4] as [number, number, number],
    holeIdx: [0, 1],
    boardIdx: [2, 3, 4],
  };
  const { chips, mult } = baseScore(hand);
  assertEquals(mult, 8);
  assertEquals(chips, 100 + 10 + 11 + 11 + 11 + 11); // base 100 + card chips (J/Q/K/A = 11)
});

Deno.test("Rng is deterministic per seed", () => {
  const a = new Rng("daily-2026-09-06");
  const b = new Rng("daily-2026-09-06");
  const deckA = a.shuffle(makeDeck());
  const deckB = b.shuffle(makeDeck());
  assertEquals(deckA, deckB);
  assertNotEquals(a.cursor, 0);
});
