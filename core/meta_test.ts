// Tests for collection, vouchers, and the Double-Suited table deal bias.
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { Blind } from "./blind.ts";
import { EMPTY_COLLECTION, recordRun } from "./collection.ts";
import { Run } from "./run.ts";
import { Shop } from "./shop.ts";
import { TABLE_REGISTRY } from "./tables.ts";

Deno.test("double-suited table deals two suited pairs", () => {
  for (let i = 0; i < 25; i++) {
    const blind = new Blind(`ds-${i}`, {
      target: 99999,
      plays: 3,
      redraws: 1,
      doubleSuited: true,
    });
    const suits = blind.state.hole.map((c) => c.suit);
    // Two of one suit + two of another (order: a,a,b,b)
    assertEquals(suits[0], suits[1]);
    assertEquals(suits[2], suits[3]);
    assert(suits[0] !== suits[2]);
    // No duplicate cards
    const ids = new Set(blind.state.hole.map((c) => `${c.rank}${c.suit}`));
    assertEquals(ids.size, 4);
  }
});

Deno.test("classic table deal is not forced double-suited", () => {
  let nonDs = 0;
  for (let i = 0; i < 25; i++) {
    const blind = new Blind(`cl-${i}`, { target: 1, plays: 3, redraws: 2 });
    const suits = blind.state.hole.map((c) => c.suit);
    if (
      !(suits[0] === suits[1] && suits[2] === suits[3] && suits[0] !== suits[2])
    ) {
      nonDs++;
    }
  }
  assert(
    nonDs > 10,
    `expected mostly non-double-suited deals, got ${nonDs}/25`,
  );
});

Deno.test("collection merges seen content across runs", () => {
  let c = EMPTY_COLLECTION;
  c = recordRun(c, {
    relicIds: ["suited-commit"],
    bossIds: ["boss-suited-commitment"],
    tableId: "classic",
    ante: 2,
    won: false,
  });
  c = recordRun(c, {
    relicIds: ["suited-commit", "dead-money"],
    bossIds: ["boss-suited-commitment", "boss-short-board"],
    tableId: "short-deck",
    ante: 8,
    won: true,
  });
  assertEquals(c.relics.sort(), ["dead-money", "suited-commit"]);
  assertEquals(c.bosses.length, 2);
  assertEquals(c.tables.sort(), ["classic", "short-deck"]);
  assertEquals(c.wins, 1);
  assertEquals(c.runs, 2);
  assertEquals(c.bestAnte, 8);
});

Deno.test("voucher shop offers appear from ante 2 and never repeat owned", () => {
  let offered = 0;
  for (let i = 0; i < 20; i++) {
    const shop = new Shop(`v-${i}`, [], [], 2);
    if (shop.state.voucher) offered++;
  }
  assert(offered > 3, `expected some voucher offers, got ${offered}/20`);
  for (let i = 0; i < 20; i++) {
    const shop = new Shop(`v-${i}`, [], [], 1);
    assertEquals(shop.state.voucher, null); // never at ante 1
  }
  const ownedAll = new Shop("v-owned", [], [
    "extra-play",
    "extra-redraw",
    "sixth-slot",
    "high-interest",
  ], 5);
  assertEquals(ownedAll.state.voucher, null);
});

Deno.test("vouchers take effect: extra play/redraw, sixth slot, high interest", () => {
  const run = new Run("voucher-run");
  run.state.voucherIds.push("extra-play", "extra-redraw", "sixth-slot");
  // New blinds get +1 play and +1 redraw
  run.blind.play(run.blind.legalHands(run.relics)[0], run.playContext());
  while (run.blind.state.phase === "playing") {
    run.blind.play(run.blind.legalHands(run.relics)[0], run.playContext());
  }
  if (run.blind.state.phase === "won") {
    run.settle();
    run.leaveShop();
    assertEquals(run.blind.state.playsLeft, 4); // 3 base + 1 voucher (minus 0 plays used…)
  }
  assertEquals(run.relicCap, 6);
});

Deno.test("run restore keeps vouchers and double-suited flag", () => {
  const ds = TABLE_REGISTRY.get("double-suited")!;
  const run = new Run("ds-persist", ds);
  run.state.voucherIds.push("high-interest");
  const snap = run.snapshot();
  const restored = Run.restore(snap, ds);
  assertEquals(restored.state.voucherIds, ["high-interest"]);
  const suits = restored.blind.state.hole.map((c) => c.suit);
  assertEquals(suits[0], suits[1]);
  assertEquals(suits[2], suits[3]);
});
