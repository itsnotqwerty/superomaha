// The 8 MVP boss blinds (spec REQ-CONTENT-2). One readable rule twist each.
// HARD RULE (scope §8.5): every boss must leave at least one legal play on a
// default Classic table with no relics — enforced by boss_test.ts fixtures.

import { Card } from "./cards.ts";
import { Modifier } from "./mods.ts";

const bySuit = (cards: Card[]) => {
  const m = new Map<string, number>();
  for (const c of cards) m.set(c.suit, (m.get(c.suit) ?? 0) + 1);
  return m;
};

export const BOSSES: Modifier[] = [
  {
    id: "boss-suited-commitment",
    name: "The Suited Sheriff",
    text: "Your two hole cards must share a suit.",
    example: "Hole A♠ K♠ 7♥ 2♦ — only A♠ K♠ may be committed.",
    // Legality filter. Always satisfiable: any 4-card deal from one deck
    // contains two same-suit cards (pigeonhole, 4 cards / 4 suits → false…
    // so the fixture test verifies per-deal and Blind guarantees a redeal
    // if no legal combo exists — see Blind.ensureLegalPlay).
    comboFilter: (holeCards) =>
      holeCards.length === 2 && holeCards[0].suit === holeCards[1].suit,
  },
  {
    id: "boss-short-board",
    name: "The Short Board",
    text: "The board has only 4 cards.",
    example: "Board A♠ K♥ 9♣ 2♦ — pick 2 hole + 3 of these 4.",
    boardSize: 4,
  },
  {
    id: "boss-no-flushes",
    name: "The Dust Bowl",
    text: "Flushes and straight flushes score as high card.",
    example: "Five spades committed — it scores as high card, not a flush.",
    recategorize: (cat) =>
      cat === "flush" || cat === "straight_flush" ? "high_card" : cat,
  },
  {
    id: "boss-blackout",
    name: "The Blackout",
    text: "Hole cards stay face-down until you commit.",
    example:
      "Pick a hole-pair tab blind — the evaluator still checks legality.",
    hideHole: true,
  },
  {
    id: "boss-dead-suit",
    name: "The Undertaker",
    text:
      "The most common suit on the board is dead — those board cards can't be used.",
    example:
      "Board shows 3 spades — spade board cards are unavailable this blind.",
    // Implemented by Blind at deal time (deadSuit), enforced via comboFilter.
    comboFilter: (_hole, _board) => true, // replaced per-deal; see Blind
  },
  {
    id: "boss-no-straights",
    name: "The Crooked Mile",
    text: "Straights and straight flushes score as high card.",
    example: "9-10-J-Q-K committed — it scores as high card.",
    recategorize: (cat) =>
      cat === "straight" || cat === "straight_flush" ? "high_card" : cat,
  },
  {
    id: "boss-redraw-tax",
    name: "The Taxman",
    text: "Start with only 1 redraw.",
    example: "The HUD shows redraws 1 — spend it wisely.",
    redraws: 1,
  },
  {
    id: "boss-runner-up",
    name: "The Runner-Up",
    text: "Only your second-best legal combo scores.",
    example: "The best hand is highlighted but locked — commit the runner-up.",
    forcePick: 1,
  },
];

export const BOSS_REGISTRY = new Map(BOSSES.map((b) => [b.id, b]));

/** Deterministic boss for an ante: ante 1 → boss[0], … ante 8 → boss[7]. */
export function bossForAnte(ante: number): Modifier {
  return BOSSES[(ante - 1) % BOSSES.length];
}

export { bySuit };
