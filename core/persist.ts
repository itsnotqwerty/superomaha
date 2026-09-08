// Persistence (spec §13 / REQ-SAVE-1): the run snapshot is plain JSON so a
// refresh never destroys an in-progress blind. Cards are serialized directly
// (hole/board/shoe remainder) — no RNG replay needed to restore.

import { Card } from "./cards.ts";
import { HandLevels } from "./scoring.ts";

export interface RunSnapshot {
  version: 1;
  seed: string;
  tableId: string;
  ante: number;
  blindIndex: number;
  phase: "playing" | "shop" | "won" | "lost";
  cash: number;
  relicIds: string[];
  handLevels: HandLevels;
  voucherIds: string[];
  endless?: boolean;
  blind: {
    seed: string;
    hole: Card[];
    board: Card[];
    shoe: Card[]; // remaining undrawn cards, in draw order (top = end)
    revealed?: number; // streets mode
    playsLeft: number;
    redrawsLeft: number;
    score: number;
    phase: "playing" | "won" | "lost";
    target: number;
  };
}

const KEY = "super-omaha/run/v1";

export function saveKey(): string {
  return KEY;
}

export function serializeSnapshot(s: RunSnapshot): string {
  return JSON.stringify(s);
}

export function parseSnapshot(raw: string | null): RunSnapshot | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s?.version !== 1 || !Array.isArray(s.blind?.hole)) return null;
    return s as RunSnapshot;
  } catch {
    return null;
  }
}
