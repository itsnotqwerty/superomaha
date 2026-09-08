// Core card primitives. Cards are immutable values; no rules logic here.

export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

// Rank 2–14, where 11=J, 12=Q, 13=K, 14=A. Ace is high by default;
// the wheel straight (A-2-3-4-5) is handled by the evaluator.
export type Rank = number; // 2..14

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const RANK_MIN = 2;
export const RANK_MAX = 14; // Ace

export function makeDeck(ranks: Rank[] = defaultRanks()): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of ranks) deck.push({ rank, suit });
  }
  return deck;
}

export function defaultRanks(): Rank[] {
  const r: Rank[] = [];
  for (let i = RANK_MIN; i <= RANK_MAX; i++) r.push(i);
  return r;
}

// Short deck (6+): ranks 6..14 — used by the "Short deck" table.
export function shortDeckRanks(): Rank[] {
  const r: Rank[] = [];
  for (let i = 6; i <= RANK_MAX; i++) r.push(i);
  return r;
}

const RANK_LABELS: Record<number, string> = {
  14: "A",
  13: "K",
  12: "Q",
  11: "J",
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank] ?? String(rank);
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}

const SUIT_LETTERS: Record<Suit, string> = {
  spades: "S",
  hearts: "H",
  diamonds: "D",
  clubs: "C",
};

/** Letter marker so suit is never signaled by color alone (spec §11.5). */
export function suitLetter(suit: Suit): string {
  return SUIT_LETTERS[suit];
}

const SUIT_NAMES: Record<Suit, string> = {
  spades: "spades",
  hearts: "hearts",
  diamonds: "diamonds",
  clubs: "clubs",
};

/** Screen-reader text: "ace of spades". */
export function cardAria(card: Card): string {
  const names: Record<number, string> = {
    14: "ace",
    13: "king",
    12: "queen",
    11: "jack",
  };
  return `${names[card.rank] ?? card.rank} of ${SUIT_NAMES[card.suit]}`;
}

// Stable id for keys and logs, e.g. "As", "Td", "2c".
export function cardId(card: Card): string {
  return `${rankLabel(card.rank)}${card.suit[0]}`;
}
