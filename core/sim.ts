// Frequency simulation (scope §6.3 / §15.1): Omaha inflates made hands, so the
// blind-target curve must be derived from measured best-hand score
// distributions — never copied from Balatro.
//
// Run with: deno run -A core/sim.ts [samples]

import { Blind } from "./blind.ts";
import { blindTarget } from "./run.ts";

const samples = Number(Deno.args[0] ?? 400);

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

// Strategy: always commit the best legal hand (a lower bound on real play,
// since players also redraw and buy relics).
for (let ante = 1; ante <= 8; ante++) {
  for (const kind of ["small", "big", "boss"] as const) {
    const totals: number[] = [];
    for (let i = 0; i < samples; i++) {
      const blind = new Blind(`sim-${ante}-${kind}-${i}`, {
        target: Number.MAX_SAFE_INTEGER,
        plays: 3,
        redraws: 0,
      });
      while (blind.state.phase === "playing") {
        blind.play(blind.legalHands([])[0], { relics: [] });
      }
      totals.push(blind.state.score);
    }
    totals.sort((a, b) => a - b);
    const p25 = percentile(totals, 0.25);
    const p50 = percentile(totals, 0.5);
    const p75 = percentile(totals, 0.75);
    const target = blindTarget(ante, kind);
    // Win if score >= target. Report the simulated win rate at current curve.
    const wins = totals.filter((t) => t >= target).length;
    console.log(
      `ante ${ante} ${kind.padEnd(5)} p25=${String(p25).padStart(5)} p50=${
        String(p50).padStart(5)
      } p75=${String(p75).padStart(5)}  target=${
        String(target).padStart(5)
      }  win%=${Math.round((100 * wins) / samples)}`,
    );
  }
}
