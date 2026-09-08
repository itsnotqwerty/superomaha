// Stakes, challenge seeds, Five-Card Omaha table, and score formatting tests.
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { Blind } from "./blind.ts";
import { formatScore } from "./numfmt.ts";
import { blindTarget, Run } from "./run.ts";
import {
  challengeSeed,
  parseChallenge,
  STAKE_REGISTRY,
  STAKES,
} from "./stakes.ts";
import { TABLE_REGISTRY } from "./tables.ts";
import { EMPTY_COLLECTION } from "./collection.ts";

Deno.test("stakes scale targets and deltas", () => {
  const base = blindTarget(4, "boss");
  const hustle = STAKE_REGISTRY.get("hard-hustle")!;
  assertEquals(
    blindTarget(4, "boss", TABLE_REGISTRY.get("classic")!, hustle),
    Math.round(base * 1.25),
  );

  const shorthanded = new Run(
    "stake-1",
    TABLE_REGISTRY.get("classic")!,
    STAKE_REGISTRY.get("shorthanded")!,
  );
  assertEquals(shorthanded.blind.state.redrawsLeft, 1); // 2 base − 1

  const degenerate = new Run(
    "stake-2",
    TABLE_REGISTRY.get("classic")!,
    STAKE_REGISTRY.get("degenerate")!,
  );
  assertEquals(degenerate.blind.state.playsLeft, 2); // 3 base − 1
});

Deno.test("stakes gate on first win", () => {
  const c = { ...EMPTY_COLLECTION };
  assert(STAKES[0].unlock(c)); // base always
  assert(!STAKES[1].unlock(c));
  assert(STAKES[1].unlock({ ...c, wins: 1 }));
  assert(!STAKES[3].unlock({ ...c, wins: 1 }));
  assert(STAKES[3].unlock({ ...c, wins: 2 }));
});

Deno.test("challenge seeds round-trip stake and table", () => {
  const seed = challengeSeed("hard-hustle", "short-deck", "rival42");
  const parsed = parseChallenge(seed)!;
  assertEquals(parsed.stakeId, "hard-hustle");
  assertEquals(parsed.tableId, "short-deck");
  assertEquals(parsed.tag, "rival42");
  assertEquals(parseChallenge("daily-2026-09-08"), null);
});

Deno.test("challenge seed runs deterministically", () => {
  const seed = challengeSeed("base", "classic", "x");
  const a = new Run(seed);
  const b = new Run(seed);
  assertEquals(a.blind.state.hole, b.blind.state.hole);
});

Deno.test("five-card omaha deals 5 hole cards with C(5,2)×C(5,3)=100 combos", () => {
  const t = TABLE_REGISTRY.get("five-card")!;
  const blind = new Blind("5c", {
    target: 99999,
    plays: t.plays,
    redraws: t.redraws,
    ranks: t.ranks(),
    holeSize: t.holeSize,
  });
  assertEquals(blind.state.hole.length, 5);
  assertEquals(blind.legalHands([]).length, 100);
  // Still exactly 2 hole cards per hand
  assert(blind.legalHands([]).every((h) => h.holeIdx.length === 2));
});

Deno.test("formatScore stays readable into endless magnitudes", () => {
  assertEquals(formatScore(42), "42");
  assertEquals(formatScore(999999999), "999999999");
  assertEquals(formatScore(1.5e9), "1.50B");
  assertEquals(formatScore(1.23e18), "1.23e18");
  assertEquals(formatScore(Infinity), "∞");
});
