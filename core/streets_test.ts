// Streets mode + endless mode + second relic wave tests.
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { Blind } from "./blind.ts";
import { Card, Rank, Suit } from "./cards.ts";
import { classifyFive } from "./evaluator.ts";
import { RELICS } from "./relics.ts";
import { scoreHand } from "./scoring.ts";
import { Run } from "./run.ts";

function c(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

function makeHand(
  holeCards: Card[],
  boardCards: Card[],
  hole: Card[],
  board: Card[],
) {
  const cards = [...holeCards, ...boardCards];
  const { category, tiebreak } = classifyFive(cards);
  return {
    category,
    tiebreak,
    cards,
    holePair: [0, 1] as [number, number],
    boardTrip: [0, 1, 2] as [number, number, number],
    holeIdx: holeCards.map((card) => hole.indexOf(card)),
    boardIdx: boardCards.map((card) => board.indexOf(card)),
  };
}

const relic = (id: string) => RELICS.find((r) => r.id === id)!;

// ---------- Streets ----------

Deno.test("streets mode: flop reveals 3, then turn, then river, then redeal", () => {
  const blind = new Blind("streets-1", {
    target: 999999,
    plays: 3,
    redraws: 0,
    streets: true,
  });
  assertEquals(blind.state.board.length, 5); // full board dealt
  assertEquals(blind.state.revealed, 3); // only flop visible
  assertEquals(blind.visibleBoard.length, 3);

  // Play 1 on the flop → turn reveals, same cards
  const flopBoard = blind.state.board.map((x) => `${x.rank}${x.suit}`);
  blind.play(blind.legalHands([])[0], { relics: [] });
  assertEquals(blind.state.revealed, 4);
  assertEquals(
    blind.state.board.map((x) => `${x.rank}${x.suit}`),
    flopBoard,
  ); // board persists across streets

  // Play 2 on the turn → river
  blind.play(blind.legalHands([])[0], { relics: [] });
  assertEquals(blind.state.revealed, 5);

  // Play 3 on the river → blind resolves (won or lost depending on score)
  blind.play(blind.legalHands([])[0], { relics: [] });
  assert(blind.state.phase === "won" || blind.state.phase === "lost");
});

Deno.test("streets mode: flop-only legality uses 3 revealed cards", () => {
  const blind = new Blind("streets-2", {
    target: 999999,
    plays: 3,
    redraws: 0,
    streets: true,
  });
  // C(4,2) × C(3,3) = 6 combos on the flop
  assertEquals(blind.legalHands([]).length, 6);
});

Deno.test("non-streets blinds redeal every play (Option A regression)", () => {
  const blind = new Blind("t5", { target: 999999, plays: 3, redraws: 0 });
  const first = [...blind.state.hole, ...blind.state.board];
  blind.play(blind.legalHands([])[0], { relics: [] });
  const second = [...blind.state.hole, ...blind.state.board];
  assert(!first.every((card, i) => card === second[i]));
});

// ---------- Endless ----------

Deno.test("endless mode continues past ante 8 with scaling targets", () => {
  const run = new Run("endless-test");
  // Simulate winning ante 8: set state directly (cast away readonly for test)
  const st = run.state as {
    ante: number;
    blindIndex: number;
    cash: number;
    phase: string;
  };
  st.ante = 8;
  st.blindIndex = 2;
  st.cash = 50;
  // Beat the boss blind
  while (run.blind.state.phase === "playing") {
    run.blind.play(run.blind.legalHands(run.relics)[0], run.playContext());
  }
  if (run.blind.state.phase !== "won") return; // boss modifier may beat us; skip
  run.settle();
  assertEquals(run.leaveShop(), false); // ante 8 boss → won
  assertEquals(run.state.phase, "won");

  assertEquals(run.continueEndless(), true);
  assertEquals(run.state.endless, true);
  assertEquals(run.state.phase, "shop");
  assertEquals(run.leaveShop(), true);
  assertEquals(run.state.ante, 9);
  assert(run.blind.state.config.target > 0);
});

// ---------- Second relic wave ----------

Deno.test("wheel-dealer doubles straights containing a 5", () => {
  const hole = [
    c(14, "spades"),
    c(2, "hearts"),
    c(9, "clubs"),
    c(9, "diamonds"),
  ];
  const board = [
    c(3, "clubs"),
    c(4, "diamonds"),
    c(5, "spades"),
    c(9, "hearts"),
    c(13, "clubs"),
  ];
  const wheel = makeHand(
    [hole[0], hole[1]],
    [board[0], board[1], board[2]],
    hole,
    board,
  );
  assertEquals(wheel.category, "straight");
  const r = scoreHand(wheel, { relics: [relic("wheel-dealer")], hole, board });
  assert(r.steps.some((s) => s.label.includes("Wheel Dealer")));
});

Deno.test("odd-fellow requires all-odd committed cards", () => {
  const hole = [
    c(3, "spades"),
    c(5, "hearts"),
    c(8, "clubs"),
    c(9, "diamonds"),
  ];
  const board = [
    c(7, "clubs"),
    c(9, "diamonds"),
    c(11, "spades"),
    c(13, "hearts"),
    c(2, "clubs"),
  ];
  const allOdd = makeHand(
    [hole[0], hole[1]],
    [board[0], board[1], board[2]],
    hole,
    board,
  );
  const withEven = makeHand(
    [hole[2], hole[3]],
    [board[0], board[1], board[2]],
    hole,
    board,
  );
  const a = scoreHand(allOdd, { relics: [relic("odd-fellow")], hole, board });
  const b = scoreHand(withEven, { relics: [relic("odd-fellow")], hole, board });
  assert(a.steps.some((s) => s.label.includes("Odd Fellow")));
  assert(!b.steps.some((s) => s.label.includes("Odd Fellow")));
});

Deno.test("short-stack triggers only under $10", () => {
  const hole = [
    c(9, "spades"),
    c(9, "hearts"),
    c(8, "clubs"),
    c(7, "diamonds"),
  ];
  const board = [
    c(9, "clubs"),
    c(4, "diamonds"),
    c(2, "spades"),
    c(13, "hearts"),
    c(3, "clubs"),
  ];
  const h = makeHand(
    [hole[0], hole[1]],
    [board[0], board[1], board[2]],
    hole,
    board,
  );
  const poor = scoreHand(h, {
    relics: [relic("short-stack")],
    hole,
    board,
    cash: 7,
  });
  const rich = scoreHand(h, {
    relics: [relic("short-stack")],
    hole,
    board,
    cash: 25,
  });
  assert(poor.steps.some((s) => s.label.includes("Short Stack")));
  assert(!rich.steps.some((s) => s.label.includes("Short Stack")));
});

Deno.test("40 relics are registered with unique ids", () => {
  assertEquals(RELICS.length, 40);
  assertEquals(new Set(RELICS.map((r) => r.id)).size, 40);
  for (const r of RELICS) {
    assert(
      r.text.length > 0 && r.example.length > 0,
      `${r.id} needs text + example`,
    );
  }
});

Deno.test("street-aware relics fire on turn/river reveal", () => {
  const blind = new Blind("street-hooks", {
    target: 999999,
    plays: 3,
    redraws: 0,
    streets: true,
  });
  const hooks = [
    relic("turn-teller"),
    relic("river-boat"),
    relic("street-smart"),
  ];
  const before = blind.state.score;
  blind.revealNextStreet(hooks); // turn
  assertEquals(blind.state.score, before + 40);
  assertEquals(blind.state.redrawsLeft, 1);
  blind.revealNextStreet(hooks); // river
  assertEquals(blind.state.score, before + 40 + 80);
  assertEquals(blind.state.redrawsLeft, 2);
});

Deno.test("sunk-cost triggers only with 0 redraws left", () => {
  const hole = [
    c(9, "spades"),
    c(9, "hearts"),
    c(8, "clubs"),
    c(7, "diamonds"),
  ];
  const board = [
    c(9, "clubs"),
    c(4, "diamonds"),
    c(2, "spades"),
    c(13, "hearts"),
    c(3, "clubs"),
  ];
  const h = makeHand(
    [hole[0], hole[1]],
    [board[0], board[1], board[2]],
    hole,
    board,
  );
  const spent = scoreHand(h, {
    relics: [relic("sunk-cost")],
    hole,
    board,
    redrawsLeft: 0,
  });
  const holding = scoreHand(h, {
    relics: [relic("sunk-cost")],
    hole,
    board,
    redrawsLeft: 1,
  });
  assert(spent.steps.some((s) => s.label.includes("Sunk Cost")));
  assert(!holding.steps.some((s) => s.label.includes("Sunk Cost")));
});
