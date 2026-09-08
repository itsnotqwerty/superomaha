// Cosmetics (scope §12.1): felts and card backs, unlocked by play milestones,
// never sold for run power. Purely visual — a CSS class on the table root.

import { Collection } from "./collection.ts";

export interface Cosmetic {
  id: string;
  name: string;
  /** CSS class applied to the table root. */
  className: string;
  /** Unlock requirement, evaluated against the collection. */
  unlock: (c: Collection) => boolean;
  unlockText: string;
}

export const FELTS: Cosmetic[] = [
  {
    id: "felt-classic",
    name: "Classic Felt",
    className: "",
    unlock: () => true,
    unlockText: "Default",
  },
  {
    id: "felt-midnight",
    name: "Midnight Felt",
    className: "felt-midnight",
    unlock: (c) => c.runs >= 3,
    unlockText: "Play 3 runs",
  },
  {
    id: "felt-royal",
    name: "Royal Felt",
    className: "felt-royal",
    unlock: (c) => c.bestAnte >= 5,
    unlockText: "Reach Ante 5",
  },
  {
    id: "felt-neon",
    name: "Neon Felt",
    className: "felt-neon",
    unlock: (c) => c.wins >= 1,
    unlockText: "Win a run",
  },
];

export const CARD_BACKS: Cosmetic[] = [
  {
    id: "back-classic",
    name: "Classic Back",
    className: "",
    unlock: () => true,
    unlockText: "Default",
  },
  {
    id: "back-circuit",
    name: "Circuit Back",
    className: "back-circuit",
    unlock: (c) => c.bosses.length >= 4,
    unlockText: "See 4 bosses",
  },
  {
    id: "back-gold",
    name: "Gold Back",
    className: "back-gold",
    unlock: (c) => c.wins >= 3,
    unlockText: "Win 3 runs",
  },
];

const KEY = "super-omaha/cosmetics/v1";

export interface CosmeticChoice {
  felt: string;
  cardBack: string;
}

export function loadCosmetics(raw: string | null): CosmeticChoice {
  try {
    if (raw) {
      return {
        felt: "felt-classic",
        cardBack: "back-classic",
        ...JSON.parse(raw),
      };
    }
  } catch { /* fall through */ }
  return { felt: "felt-classic", cardBack: "back-classic" };
}

export function cosmeticsKey(): string {
  return KEY;
}

export function classFor(cosmetics: Cosmetic[], id: string): string {
  return cosmetics.find((c) => c.id === id)?.className ?? "";
}
