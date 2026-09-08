// Cosmetics unlock rules + street-hook relic tests already cover onStreet;
// this file covers cosmetic gating.
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { EMPTY_COLLECTION } from "./collection.ts";
import { CARD_BACKS, classFor, FELTS, loadCosmetics } from "./cosmetics.ts";

Deno.test("default cosmetics are always unlocked", () => {
  const c = { ...EMPTY_COLLECTION };
  assert(FELTS[0].unlock(c));
  assert(CARD_BACKS[0].unlock(c));
});

Deno.test("milestone unlocks gate later cosmetics", () => {
  const c = { ...EMPTY_COLLECTION };
  assert(!FELTS.find((f) => f.id === "felt-midnight")!.unlock(c));
  assert(
    FELTS.find((f) => f.id === "felt-midnight")!.unlock({ ...c, runs: 3 }),
  );
  assert(!FELTS.find((f) => f.id === "felt-neon")!.unlock(c));
  assert(FELTS.find((f) => f.id === "felt-neon")!.unlock({ ...c, wins: 1 }));
  assert(
    CARD_BACKS.find((b) => b.id === "back-circuit")!.unlock({
      ...c,
      bosses: ["a", "b", "c", "d"],
    }),
  );
});

Deno.test("loadCosmetics round-trips and defaults safely", () => {
  assertEquals(loadCosmetics(null), {
    felt: "felt-classic",
    cardBack: "back-classic",
  });
  assertEquals(
    loadCosmetics('{"felt":"felt-royal"}'),
    { felt: "felt-royal", cardBack: "back-classic" },
  );
  assertEquals(classFor(FELTS, "felt-royal"), "felt-royal");
  assertEquals(classFor(FELTS, "nope"), "");
});
