// Replay validator tests: genuine action logs must verify; forged claims
// must fail. This is the leaderboard's anti-cheat core (scope §16).
import { assertEquals } from "jsr:@std/assert@^1";
import { Run } from "../core/run.ts";
import { Replay, validateReplay } from "./validate.ts";

/** Play a genuine daily run and produce its replay. */
function genuineReplay(seed: string): Replay {
  const run = new Run(seed);
  while (run.state.phase === "playing" || run.state.phase === "shop") {
    if (run.state.phase === "playing") {
      const pick = run.blind.defaultPick(run.relics) ??
        run.blind.legalHands(run.relics)[0];
      if (!pick) break;
      run.commitPlay(pick.holeIdx, pick.boardIdx);
      if (run.blind.state.phase !== "playing") run.settle();
    } else {
      run.leaveShop();
    }
    if (run.actionLog.length > 500) break; // safety
  }
  const s = run.state;
  return {
    seed,
    tableId: s.tableId,
    actions: [...run.actionLog],
    claimed: {
      ante: s.ante,
      cash: s.cash,
      won: s.phase === "won" || (s.endless && s.ante > 8),
      phase: s.phase,
    },
  };
}

Deno.test("genuine replay validates", () => {
  const replay = genuineReplay("daily-2026-09-08");
  const result = validateReplay(replay);
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

Deno.test("forged claimed score fails validation", () => {
  const replay = genuineReplay("daily-2026-09-08");
  replay.claimed.cash += 1000; // cheat: inflate cash
  const result = validateReplay(replay);
  assertEquals(result.valid, false);
  assertEquals(result.error, "claimed result does not match replay");
});

Deno.test("forged ante fails validation", () => {
  const replay = genuineReplay("daily-2026-09-08");
  replay.claimed.ante = 8;
  replay.claimed.won = true;
  assertEquals(validateReplay(replay).valid, false);
});

Deno.test("truncated action log fails validation", () => {
  const replay = genuineReplay("daily-2026-09-08");
  replay.actions = replay.actions.slice(0, 2); // claim the full result from 2 actions
  assertEquals(validateReplay(replay).valid, false);
});

Deno.test("unknown table and empty log are rejected", () => {
  assertEquals(
    validateReplay({
      seed: "x",
      tableId: "nope",
      actions: [],
      claimed: { ante: 1, cash: 0, won: false, phase: "lost" },
    }).valid,
    false,
  );
});

Deno.test("same seed replays deterministically (two runs, same log)", () => {
  const a = genuineReplay("daily-2026-09-09");
  const b = genuineReplay("daily-2026-09-09");
  assertEquals(a.claimed, b.claimed);
  assertEquals(a.actions.length, b.actions.length);
});
