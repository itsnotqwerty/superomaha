// Blind lifecycle + scoring pipeline tests (spec §4, §5).
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { Blind } from "./blind.ts";
import { scoreHand } from "./scoring.ts";
import { classifyFive } from "./evaluator.ts";
import { Card, Rank, Suit } from "./cards.ts";
import { blindTarget, Run } from "./run.ts";

function c(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

Deno.test("scoring pipeline emits ordered steps ending in the total", () => {
  const cards = [
    c(14, "spades"),
    c(14, "hearts"),
    c(13, "clubs"),
    c(7, "diamonds"),
    c(2, "spades"),
  ];
  const { category, tiebreak } = classifyFive(cards);
  const result = scoreHand({
    category,
    tiebreak,
    cards,
    holePair: [0, 1],
    boardTrip: [0, 1, 2],
    holeIdx: [0, 1],
    boardIdx: [0, 1, 2],
  });
  assertEquals(result.hand.category, "pair");
  assertEquals(result.steps[0].step, 3); // classification anchor
  assertEquals(result.steps[1].step, 4); // card chips
  // pair: (10 + 11+11+11+7+2 capped card chips) × 2 = 52 × 2 = 104
  assertEquals(result.total, 104);
  assertEquals(result.steps.at(-1)!.total, 104);
});

Deno.test("blind deals 4 hole + 5 board with no duplicate cards", () => {
  const blind = new Blind("t1", { target: 1000, plays: 3, redraws: 2 });
  const { hole, board } = blind.state;
  assertEquals(hole.length, 4);
  assertEquals(board.length, 5);
  const ids = new Set([...hole, ...board].map((x) => `${x.rank}${x.suit}`));
  assertEquals(ids.size, 9);
});

Deno.test("blind is deterministic per seed", () => {
  const a = new Blind("seed-x", { target: 100, plays: 3, redraws: 2 });
  const b = new Blind("seed-x", { target: 100, plays: 3, redraws: 2 });
  assertEquals(a.state.hole, b.state.hole);
  assertEquals(a.state.board, b.state.board);
  assertEquals(a.legalHands()[0].cards, b.legalHands()[0].cards);
});

Deno.test("redraw replaces selected cards, burns redraws, blocks when empty", () => {
  const blind = new Blind("t2", { target: 99999, plays: 3, redraws: 1 });
  const before = blind.state.hole[0];
  assertEquals(blind.redraw([0], []), true);
  assertEquals(blind.state.redrawsLeft, 1 - 1);
  const ids = [...blind.state.hole, ...blind.state.board].map((x) =>
    `${x.rank}${x.suit}`
  );
  assertEquals(new Set(ids).size, 9); // no dupes after redraw
  assertEquals(blind.redraw([0], []), false); // no redraws left
  void before;
});

Deno.test("blind wins when score reaches target; stops accepting plays", () => {
  const blind = new Blind("t3", { target: 10, plays: 3, redraws: 0 });
  const ctx = { relics: [] };
  const best = blind.legalHands()[0];
  const result = blind.play(best, ctx);
  assert(result);
  assertEquals(blind.state.phase, "won");
  assertEquals(blind.play(blind.legalHands()[0], ctx), null);
});

Deno.test("blind loses when plays run out below target", () => {
  const blind = new Blind("t4", { target: 999999, plays: 3, redraws: 0 });
  const ctx = { relics: [] };
  for (let i = 0; i < 3; i++) {
    assertEquals(blind.state.phase, "playing");
    blind.play(blind.legalHands()[0], ctx);
  }
  assertEquals(blind.state.phase, "lost");
});

Deno.test("Option A: each play redeals a fresh hole and board", () => {
  const blind = new Blind("t5", { target: 999999, plays: 3, redraws: 0 });
  const first = [...blind.state.hole, ...blind.state.board];
  blind.play(blind.legalHands()[0], { relics: [] });
  const second = [...blind.state.hole, ...blind.state.board];
  assertEquals(
    first.every((card, i) => card === second[i]),
    false,
  );
});

Deno.test("run flow with beatable targets: ante progression and cash", () => {
  const run = new Run("flow");
  // Drive the current blind by playing the best hand each time.
  const playOut = () => {
    while (run.blind.state.phase === "playing") {
      run.blind.play(run.blind.legalHands(run.relics)[0], run.playContext());
    }
  };
  playOut();
  const won = run.blind.state.phase === "won";
  if (won) {
    const cashBefore = run.state.cash;
    assertEquals(run.settle(), true);
    assertEquals(run.state.phase, "shop");
    assert(run.state.cash > cashBefore); // payout + bonuses
    assertEquals(run.leaveShop(), true);
    assertEquals(run.kind, "big");
  } else {
    assertEquals(run.settle(), false); // lost blind ends the run
    assertEquals(run.state.phase, "lost");
  }
});

Deno.test("blindTarget scales by ante and kind", () => {
  assert(blindTarget(2, "small") > blindTarget(1, "small"));
  assert(blindTarget(1, "boss") > blindTarget(1, "big"));
  assert(blindTarget(1, "big") > blindTarget(1, "small"));
});
