// Replay validation (scope §16): a leaderboard submission is seed + action
// log; the server replays it through the rules core and only trusts the
// result if the replayed final state matches the claimed one.

import { Action, Run } from "../core/run.ts";
import { TABLE_REGISTRY } from "../core/tables.ts";

export interface Replay {
  seed: string;
  tableId: string;
  actions: Action[];
  claimed: { ante: number; cash: number; won: boolean; phase: string };
}

export function validateReplay(replay: Replay): {
  valid: boolean;
  error?: string;
} {
  const table = TABLE_REGISTRY.get(replay.tableId);
  if (!table) return { valid: false, error: "unknown table" };
  if (!Array.isArray(replay.actions) || replay.actions.length === 0) {
    return { valid: false, error: "empty action log" };
  }
  if (replay.actions.length > 2000) {
    return { valid: false, error: "action log too long" };
  }

  let run: Run;
  try {
    run = new Run(replay.seed, table);
  } catch {
    return { valid: false, error: "bad seed" };
  }

  for (const a of replay.actions) {
    try {
      switch (a.type) {
        case "play":
          if (!run.commitPlay(a.holeIdx, a.boardIdx)) {
            return {
              valid: false,
              error: `illegal play at ${run.actionLog.length}`,
            };
          }
          break;
        case "redraw":
          if (!run.commitRedraw(a.holeIdx, a.boardIdx)) {
            return { valid: false, error: "illegal redraw" };
          }
          break;
        case "settle":
          if (!run.settle()) {
            return { valid: false, error: "settle out of phase" };
          }
          break;
        case "leaveShop":
          if (!run.leaveShop()) {
            return { valid: false, error: "leaveShop out of phase" };
          }
          break;
        case "buyItem":
          if (!run.buyItem(a.slot)) {
            return { valid: false, error: "illegal buy" };
          }
          break;
        case "buyPack":
          if (!run.buyPackOption(a.option)) {
            return { valid: false, error: "illegal pack buy" };
          }
          break;
        case "buyVoucher":
          if (!run.buyVoucher()) {
            return { valid: false, error: "illegal voucher" };
          }
          break;
        case "sellRelic":
          if (!run.sellRelic(a.index)) {
            return { valid: false, error: "illegal sell" };
          }
          break;
        case "reroll":
          if (!run.rerollShop()) {
            return { valid: false, error: "illegal reroll" };
          }
          break;
        default:
          return { valid: false, error: "unknown action" };
      }
    } catch {
      return { valid: false, error: "replay diverged" };
    }
  }

  const s = run.state;
  const won = s.phase === "won" || (s.endless && s.ante > 8);
  if (
    s.ante !== replay.claimed.ante ||
    s.cash !== replay.claimed.cash ||
    won !== replay.claimed.won
  ) {
    return { valid: false, error: "claimed result does not match replay" };
  }
  return { valid: true };
}
