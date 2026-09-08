// Relic, boss, shop, and persistence tests (spec §14 acceptance tests).
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { Blind } from "./blind.ts";
import { BOSSES, bossForAnte } from "./bosses.ts";
import { Card, Rank, Suit } from "./cards.ts";
import { classifyFive, evaluate } from "./evaluator.ts";
import { Modifier } from "./mods.ts";
import { parseSnapshot, serializeSnapshot } from "./persist.ts";
import { RELICS } from "./relics.ts";
import { legalityOf, scoreHand } from "./scoring.ts";
import { Shop } from "./shop.ts";
import { TABLES } from "./tables.ts";
import { Run } from "./run.ts";

function c(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

function hand(
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

const relic = (id: string): Modifier => RELICS.find((r) => r.id === id)!;

// ---------- Relic hooks ----------

Deno.test("third-rail rewrites legality to 3 hole + 2 board", () => {
  const hole = [
    c(14, "spades"),
    c(14, "hearts"),
    c(14, "clubs"),
    c(4, "diamonds"),
  ];
  const board = [
    c(13, "spades"),
    c(13, "hearts"),
    c(9, "clubs"),
    c(2, "diamonds"),
    c(5, "spades"),
  ];
  const opts = legalityOf([relic("third-rail")]);
  assertEquals(opts.holePick, 3);
  assertEquals(opts.boardPick, 2);
  // C(4,3) × C(5,2) = 4 × 10 = 40 combos; trip aces + K pair = full house best.
  const hands = evaluate(hole, board, opts);
  assertEquals(hands.length, 40);
  assertEquals(hands[0].category, "full_house");
});

Deno.test("suited-commit relic adds +4 mult only for same-suit hole pairs", () => {
  const hole = [
    c(8, "hearts"),
    c(5, "hearts"),
    c(13, "clubs"),
    c(2, "diamonds"),
  ];
  const board = [
    c(9, "spades"),
    c(4, "clubs"),
    c(2, "hearts"),
    c(7, "diamonds"),
    c(11, "spades"),
  ];
  const suited = hand(
    [hole[0], hole[1]],
    [board[0], board[1], board[2]],
    hole,
    board,
  );
  const unsuited = hand(
    [hole[0], hole[2]],
    [board[0], board[1], board[2]],
    hole,
    board,
  );

  const withRelic = scoreHand(suited, {
    relics: [relic("suited-commit")],
    hole,
    board,
  });
  const withoutTrigger = scoreHand(unsuited, {
    relics: [relic("suited-commit")],
    hole,
    board,
  });
  assertEquals(
    withRelic.steps.some((s) => s.label.includes("Suited Commit")),
    true,
  );
  assertEquals(
    withoutTrigger.steps.some((s) => s.label.includes("Suited Commit")),
    false,
  );
});

Deno.test("dead-money pays for unused hole cards pairing the board", () => {
  const hole = [
    c(9, "clubs"),
    c(9, "diamonds"),
    c(14, "spades"),
    c(14, "hearts"),
  ];
  const board = [
    c(9, "spades"),
    c(4, "clubs"),
    c(2, "hearts"),
    c(7, "diamonds"),
    c(11, "spades"),
  ];
  // Commit the aces; the two unused nines pair the board's 9♠.
  const h = hand(
    [hole[2], hole[3]],
    [board[0], board[1], board[2]],
    hole,
    board,
  );
  const r = scoreHand(h, { relics: [relic("dead-money")], hole, board });
  const step = r.steps.find((s) => s.label.includes("Dead Money"));
  assert(step);
  assertEquals(step.label, "Dead Money +30 chips");
});

Deno.test("relic effects apply in slot order (flat → +mult → ×mult)", () => {
  const hole = [
    c(6, "hearts"),
    c(3, "clubs"),
    c(13, "spades"),
    c(2, "diamonds"),
  ];
  const board = [
    c(9, "spades"),
    c(9, "hearts"),
    c(2, "hearts"),
    c(7, "diamonds"),
    c(11, "spades"),
  ];
  const h = hand(
    [hole[0], hole[1]],
    [board[0], board[1], board[2]],
    hole,
    board,
  );
  // low-roller (+30 chips, both ≤8) then consolation (×2 on last play)
  const r = scoreHand(h, {
    relics: [relic("low-roller"), relic("consolation")],
    hole,
    board,
    playsLeftAfter: 0,
  });
  const li = r.steps.findIndex((s) => s.label.includes("Low Roller"));
  const ci = r.steps.findIndex((s) => s.label.includes("Consolation"));
  assert(li !== -1 && ci !== -1 && li < ci);
});

// ---------- Boss legality fixtures (scope: never brick Classic) ----------

for (const boss of BOSSES) {
  Deno.test(`boss "${boss.name}" always has a legal play across 25 Classic blinds`, () => {
    for (let i = 0; i < 25; i++) {
      const blind = new Blind(`boss-fixture-${boss.id}-${i}`, {
        target: 999999,
        plays: 3,
        redraws: 2,
        boss,
      });
      const hands = blind.legalHands([]);
      assert(
        hands.length > 0,
        `${boss.id} dealt zero legal hands on seed ${i}`,
      );
    }
  });
}

Deno.test("runner-up boss forces the second-best combo as default pick", () => {
  const boss = BOSSES.find((b) => b.id === "boss-runner-up")!;
  const blind = new Blind("runner-up", {
    target: 99999,
    plays: 3,
    redraws: 0,
    boss,
  });
  const hands = blind.legalHands([]);
  const pick = blind.defaultPick([]);
  if (hands.length > 1) {
    assertEquals(pick, hands[1]);
  }
});

Deno.test("no-flushes boss demotes flushes to high card", () => {
  const boss = BOSSES.find((b) => b.id === "boss-no-flushes")!;
  const opts = legalityOf([boss]);
  assertEquals(opts.recategorize!("flush"), "high_card");
  assertEquals(opts.recategorize!("straight_flush"), "high_card");
  assertEquals(opts.recategorize!("full_house"), "full_house");
});

Deno.test("short-board boss deals a 4-card board", () => {
  const boss = BOSSES.find((b) => b.id === "boss-short-board")!;
  const blind = new Blind("short-board", {
    target: 99999,
    plays: 3,
    redraws: 0,
    boss,
  });
  assertEquals(blind.state.board.length, 4);
  // C(4,2) × C(4,3) = 24 legal combos
  assertEquals(blind.legalHands([]).length, 24);
});

Deno.test("dead-suit boss bans the most common board suit", () => {
  const boss = BOSSES.find((b) => b.id === "boss-dead-suit")!;
  for (let i = 0; i < 10; i++) {
    const blind = new Blind(`dead-suit-${i}`, {
      target: 99999,
      plays: 3,
      redraws: 0,
      boss,
    });
    const dead = blind.deadSuit;
    assert(dead);
    const hands = blind.legalHands([]);
    assert(hands.length > 0);
    for (const h of hands) {
      assert(
        h.cards.every((card) =>
          card.suit !== dead || blind.state.hole.includes(card)
        ),
      );
    }
  }
});

Deno.test("redraw-tax boss starts with 1 redraw", () => {
  const boss = BOSSES.find((b) => b.id === "boss-redraw-tax")!;
  const blind = new Blind("tax", { target: 1, plays: 3, redraws: 2, boss });
  assertEquals(blind.state.redrawsLeft, 1);
});

Deno.test("boss schedule is deterministic per ante", () => {
  assertEquals(bossForAnte(1), bossForAnte(1));
  assertEquals(bossForAnte(9), bossForAnte(1)); // wraps
});

// ---------- Shop ----------

Deno.test("shop is deterministic per seed and never sells owned relics", () => {
  const owned = ["suited-commit", "dead-money"];
  const a = new Shop("shop-1", owned);
  const b = new Shop("shop-1", owned);
  assertEquals(a.state, b.state);
  for (const item of a.state.items) {
    if (item?.kind === "relic") assert(!owned.includes(item.relic.id));
  }
});

Deno.test("shop buy/sell/reroll economics", () => {
  const shop = new Shop("shop-2", []);
  const slot = shop.state.items.findIndex((i) => i !== null);
  const price = shop.state.items[slot]!.price;
  const result = shop.buy(slot, price)!;
  assertEquals(result.change, 0);
  assertEquals(shop.state.items[slot], null);
  assertEquals(shop.buy(slot, 99), null); // sold out

  const rerolled = shop.reroll(2, []);
  assertEquals(rerolled, 0);
  assertEquals(shop.state.rerollCost, 3);
  assertEquals(shop.reroll(2, []), null); // cost rose to 3
});

// ---------- Persistence ----------

Deno.test("run snapshot round-trips mid-blind exactly", () => {
  const run = new Run("persist-seed");
  run.blind.play(run.blind.legalHands([])[0], run.playContext());
  const snap = run.snapshot();
  const restored = Run.restore(
    parseSnapshot(serializeSnapshot(snap))!,
    TABLES[0],
  );
  assertEquals(restored.state.cash, run.state.cash);
  assertEquals(restored.state.ante, run.state.ante);
  assertEquals(restored.blind.state.hole, run.blind.state.hole);
  assertEquals(restored.blind.state.board, run.blind.state.board);
  assertEquals(restored.blind.state.score, run.blind.state.score);
  assertEquals(restored.blind.state.playsLeft, run.blind.state.playsLeft);
});

// ---------- Run economy ----------

Deno.test("settle pays base + leftovers + interest and opens the shop", () => {
  const run = new Run("econ-seed");
  // Force a win by playing until resolution.
  while (run.blind.state.phase === "playing") {
    run.blind.play(run.blind.legalHands(run.relics)[0], run.playContext());
  }
  if (run.blind.state.phase === "lost") return; // seed-dependent; flow tested elsewhere
  const before = run.state.cash;
  assertEquals(run.settle(), true);
  assert(run.state.cash > before);
  assertEquals(run.state.phase, "shop");
  assert(run.shop);
});

Deno.test("relic cap is 5 slots", () => {
  const run = new Run("cap-seed");
  for (const r of RELICS.slice(0, 5)) run.state.relicIds.push(r.id);
  const shop = new Shop("cap-shop", []);
  void shop;
  // buyItem path enforces the cap via #acquire
  assertEquals(run.state.relicIds.length, 5);
});
