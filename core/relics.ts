// The 15 MVP relics (spec REQ-CONTENT-1). Every relic interacts with Omaha
// structure: hole selection, board state, or the 2+3 rule itself.
// Text rule (scope §11.6): one sentence plus one example.

import { Card } from "./cards.ts";
import { Modifier } from "./mods.ts";

const sameSuit = (a: Card, b: Card) => a.suit === b.suit;

export const RELICS: Modifier[] = [
  {
    id: "third-rail",
    name: "Third Rail",
    text: "Play exactly 3 hole cards and 2 board cards.",
    example:
      "Hole A♠ A♥ K♣ 4♦, board A♦ 7♠ 2♣ 9♥ 5♠ — commit A♠ A♥ K♣ with A♦ 7♠ for trip aces with the board pair rule inverted.",
    shape: { hole: 3, board: 2 },
  },
  {
    id: "lone-wolf",
    name: "Lone Wolf",
    text: "Play exactly 1 hole card and 4 board cards.",
    example:
      "Hole K♠ 7♥ 4♣ 2♦, board Q♠ J♠ 10♠ 9♠ 8♦ — commit only K♠ with Q♠ J♠ 10♠ 9♠ for a flush draw the board almost makes alone.",
    shape: { hole: 1, board: 4 },
  },
  {
    id: "suited-commit",
    name: "Suited Commit",
    text: "If your two committed hole cards share a suit, +4 mult.",
    example:
      "Commit 8♥ 5♥ from the hole — any legal board triple gets +4 mult.",
    onScore: (ctx) =>
      ctx.holeCards.length === 2 && sameSuit(ctx.holeCards[0], ctx.holeCards[1])
        ? { plusMult: 4, note: "Suited Commit +4 mult" }
        : null,
  },
  {
    id: "dead-money",
    name: "Dead Money",
    text: "Each unused hole card that pairs any board card adds +15 chips.",
    example:
      "Hole 9♣ 9♦ unused while the board shows 9♠ — both nines pay +15 chips each.",
    onScore: (ctx) => {
      const boardRanks = new Set(ctx.board.map((c) => c.rank));
      const payers = ctx.unusedHole.filter((c) => boardRanks.has(c.rank));
      return payers.length
        ? {
          flatChips: 15 * payers.length,
          note: `Dead Money +${15 * payers.length} chips`,
        }
        : null;
    },
  },
  {
    id: "river-rat",
    name: "River Rat",
    text: "The last board card scores its chips twice.",
    example:
      "Board …4♣ K♦ — the K♦ counts 11 chips twice whenever it's committed.",
    onScore: (ctx) => {
      const last = ctx.board[ctx.board.length - 1];
      return ctx.boardCards.some((c) => c === last)
        ? {
          flatChips: Math.min(last.rank, 11),
          note: "River Rat doubles the river",
        }
        : null;
    },
  },
  {
    id: "board-pair-pays",
    name: "Board Pair Pays",
    text: "If the board contains a pair, +3 mult.",
    example: "Board 7♠ 7♥ K♣ 2♦ 9♣ — every play this deal gets +3 mult.",
    onScore: (ctx) => {
      const ranks = ctx.board.map((c) => c.rank);
      return new Set(ranks).size < ranks.length
        ? { plusMult: 3, note: "Board Pair Pays +3 mult" }
        : null;
    },
  },
  {
    id: "rainbow-tax",
    name: "Rainbow Tax",
    text: "If the committed board cards show 3 different suits, +2 mult.",
    example: "Commit board 9♠ 9♥ 4♣ — three suits, +2 mult.",
    onScore: (ctx) => {
      const suits = new Set(ctx.boardCards.map((c) => c.suit));
      return suits.size >= 3
        ? { plusMult: 2, note: "Rainbow Tax +2 mult" }
        : null;
    },
  },
  {
    id: "monochrome",
    name: "Monochrome",
    text: "If your committed board cards are all one suit, ×2 mult.",
    example: "Commit board 4♠ 9♠ K♠ — all spades, mult doubles.",
    onScore: (ctx) =>
      ctx.boardCards.length >= 3 &&
        ctx.boardCards.every((c) => c.suit === ctx.boardCards[0].suit)
        ? { multMult: 2, note: "Monochrome ×2" }
        : null,
  },
  {
    id: "low-roller",
    name: "Low Roller",
    text: "If both committed hole cards are 8 or lower, +30 chips.",
    example: "Commit 6♥ 3♣ — +30 chips before mult.",
    onScore: (ctx) =>
      ctx.holeCards.length === 2 && ctx.holeCards.every((c) => c.rank <= 8)
        ? { flatChips: 30, note: "Low Roller +30 chips" }
        : null,
  },
  {
    id: "court-fees",
    name: "Court Fees",
    text: "Each face card or ace in your committed hand adds +5 chips.",
    example: "Commit K♠ Q♦ + board J♥ 9♣ 2♠ — K, Q, J pay +15 chips total.",
    onScore: (ctx) => {
      const courts = ctx.hand.cards.filter((c) => c.rank >= 11).length;
      return courts
        ? { flatChips: 5 * courts, note: `Court Fees +${5 * courts} chips` }
        : null;
    },
  },
  {
    id: "consolation",
    name: "Consolation",
    text: "On your last play of a blind, ×2 mult.",
    example: "Plays left reads 1 — this commit's mult doubles.",
    onScore: (ctx) =>
      ctx.playsLeftAfter === 0 ? { multMult: 2, note: "Consolation ×2" } : null,
  },
  {
    id: "deep-pockets",
    name: "Deep Pockets",
    text: "+1 mult for every $5 you hold (max +6).",
    example: "Holding $27 — +5 mult on every play.",
    onScore: (ctx) => {
      const bonus = Math.min(6, Math.floor(ctx.cash / 5));
      return bonus > 0
        ? { plusMult: bonus, note: `Deep Pockets +${bonus} mult` }
        : null;
    },
  },
  {
    id: "anchor",
    name: "Anchor",
    text: "After every play, the first board card stays for the next deal.",
    example:
      "Board K♠ 7♥ 4♣ 2♦ 9♣ — commit anything, and K♠ anchors the next board.",
    // Implemented by Blind (carry-over), not a score hook.
  },
  {
    id: "sticky-ace",
    name: "Sticky Ace",
    text: "After every play, the highest hole card stays in your hand.",
    example:
      "Hole A♠ K♥ 7♣ 2♦ — commit any pair, and A♠ persists to the next deal.",
    // Implemented by Blind (carry-over), not a score hook.
  },
  {
    id: "double-dip",
    name: "Double Dip",
    text: "Your second-best legal combo also scores at half value.",
    example:
      "Best is a flush, second-best a straight — both pay, the straight at 50%.",
    // Implemented by Blind (needs full ranking), not a score hook.
  },
  // --- Second wave (toward the post-MVP 60–80 target; scope §8.1) ---
  {
    id: "wheel-dealer",
    name: "Wheel Dealer",
    text: "Straights containing a 5 get ×2 mult.",
    example: "A-2-3-4-5 or 2-3-4-5-6 both double their mult.",
    onScore: (ctx) =>
      (ctx.hand.category === "straight" ||
          ctx.hand.category === "straight_flush") &&
        ctx.hand.cards.some((c) => c.rank === 5)
        ? { multMult: 2, note: "Wheel Dealer ×2" }
        : null,
  },
  {
    id: "flush-rush",
    name: "Flush Rush",
    text: "Flushes score +20 chips.",
    example: "Any committed flush — five spades, five hearts — adds +20 chips.",
    onScore: (ctx) =>
      ctx.hand.category === "flush" || ctx.hand.category === "straight_flush"
        ? { flatChips: 20, note: "Flush Rush +20 chips" }
        : null,
  },
  {
    id: "pair-press",
    name: "Pair Press",
    text: "Pairs and two pair score +2 mult.",
    example: "A humble pair of fours still gets +2 mult.",
    onScore: (ctx) =>
      ctx.hand.category === "pair" || ctx.hand.category === "two_pair"
        ? { plusMult: 2, note: "Pair Press +2 mult" }
        : null,
  },
  {
    id: "board-lock-pair",
    name: "Set Mining",
    text: "If a committed hole card pairs a board card, +15 chips per pair.",
    example: "Hole 8♠ committed while the board shows 8♥ — +15 chips.",
    onScore: (ctx) => {
      const boardRanks = new Set(ctx.boardCards.map((c) => c.rank));
      const hits = ctx.holeCards.filter((c) => boardRanks.has(c.rank)).length;
      return hits
        ? { flatChips: 15 * hits, note: `Set Mining +${15 * hits} chips` }
        : null;
    },
  },
  {
    id: "odd-fellow",
    name: "Odd Fellow",
    text: "If every committed card has an odd rank, ×2 mult.",
    example: "3♠ 5♥ + 7♣ 9♦ J♠ — all odd, mult doubles.",
    onScore: (ctx) =>
      ctx.hand.cards.every((c) => c.rank % 2 === 1)
        ? { multMult: 2, note: "Odd Fellow ×2" }
        : null,
  },
  {
    id: "even-money",
    name: "Even Money",
    text: "If every committed card has an even rank, +40 chips.",
    example: "2♠ 4♥ + 6♣ 8♦ 10♠ — all even, +40 chips.",
    onScore: (ctx) =>
      ctx.hand.cards.every((c) => c.rank % 2 === 0)
        ? { flatChips: 40, note: "Even Money +40 chips" }
        : null,
  },
  {
    id: "face-off",
    name: "Face-Off",
    text: "Commits with no face cards or aces get +3 mult.",
    example: "10♠ 9♥ + 8♣ 5♦ 2♠ — nothing above ten, +3 mult.",
    onScore: (ctx) =>
      ctx.hand.cards.every((c) => c.rank <= 10)
        ? { plusMult: 3, note: "Face-Off +3 mult" }
        : null,
  },
  {
    id: "full-court",
    name: "Full Court",
    text: "Full houses score ×1.5 mult (rounded down).",
    example: "A full house at mult 4 becomes mult 6.",
    onScore: (ctx) =>
      ctx.hand.category === "full_house"
        ? { multMult: 1.5, note: "Full Court ×1.5" }
        : null,
  },
  {
    id: "short-stack",
    name: "Short Stack",
    text: "If you hold less than $10, +4 mult.",
    example: "Down to $7 — every play gets +4 mult until you earn back up.",
    onScore: (ctx) =>
      ctx.cash < 10 ? { plusMult: 4, note: "Short Stack +4 mult" } : null,
  },
  {
    id: "top-card",
    name: "Top Card",
    text: "If the highest committed card is an ace, +25 chips.",
    example: "Any legal hand topped by an ace adds +25 chips.",
    onScore: (ctx) =>
      Math.max(...ctx.hand.cards.map((c) => c.rank)) === 14
        ? { flatChips: 25, note: "Top Card +25 chips" }
        : null,
  },
  // --- Third wave: street-aware and build-around relics ---
  {
    id: "turn-teller",
    name: "Turn Teller",
    text: "When the turn is revealed, score +40 chips.",
    example: "On a streets table, every turn reveal pays 40 chips instantly.",
    onStreet: (street) =>
      street === "turn" ? { score: 40, note: "Turn Teller +40" } : null,
  },
  {
    id: "river-boat",
    name: "River Boat",
    text: "When the river is revealed, score +80 chips.",
    example: "On a streets table, every river reveal pays 80 chips instantly.",
    onStreet: (street) =>
      street === "river" ? { score: 80, note: "River Boat +80" } : null,
  },
  {
    id: "street-smart",
    name: "Street Smart",
    text: "When any street is revealed, gain a redraw.",
    example: "On Naked Board, the turn and river each refund a redraw.",
    onStreet: () => ({ redraws: 1, note: "Street Smart +1 redraw" }),
  },
  {
    id: "paired-board-mult",
    name: "Board Reads Pair",
    text: "If your committed board cards contain a pair, ×1.5 mult.",
    example: "Commit board 9♠ 9♥ K♦ — the board pair doubles-ish your mult.",
    onScore: (ctx) => {
      const ranks = ctx.boardCards.map((c) => c.rank);
      return new Set(ranks).size < ranks.length
        ? { multMult: 1.5, note: "Board Reads Pair ×1.5" }
        : null;
    },
  },
  {
    id: "hole-diversity",
    name: "Diversified Portfolio",
    text: "If your four hole cards show four suits, +3 mult.",
    example: "Hole A♠ K♥ 7♣ 2♦ — all four suits, +3 mult on every play.",
    onScore: (ctx) =>
      new Set(ctx.hole.map((c) => c.suit)).size === 4
        ? { plusMult: 3, note: "Diversified Portfolio +3 mult" }
        : null,
  },
  {
    id: "trips-please",
    name: "Trips Please",
    text: "Three of a kind scores +30 chips.",
    example: "Any committed trips adds +30 chips before mult.",
    onScore: (ctx) =>
      ctx.hand.category === "three_of_a_kind"
        ? { flatChips: 30, note: "Trips Please +30 chips" }
        : null,
  },
  {
    id: "high-roller",
    name: "High Roller",
    text: "High card hands score ×3 mult.",
    example: "Even a whiffed commit (ace high) triples its mult.",
    onScore: (ctx) =>
      ctx.hand.category === "high_card"
        ? { multMult: 3, note: "High Roller ×3" }
        : null,
  },
  {
    id: "four-play",
    name: "Four Play",
    text: "Four of a kind scores ×2 mult.",
    example: "Quads double their already-huge mult.",
    onScore: (ctx) =>
      ctx.hand.category === "four_of_a_kind"
        ? { multMult: 2, note: "Four Play ×2" }
        : null,
  },
  {
    id: "gap-closer",
    name: "Gap Closer",
    text: "Straights score +25 chips.",
    example: "Any committed straight adds +25 chips.",
    onScore: (ctx) =>
      ctx.hand.category === "straight" ||
        ctx.hand.category === "straight_flush"
        ? { flatChips: 25, note: "Gap Closer +25 chips" }
        : null,
  },
  {
    id: "black-sheep",
    name: "Black Sheep",
    text: "Commits using only black suits get +20 chips.",
    example: "All spades and clubs in the 2+3 — +20 chips.",
    onScore: (ctx) =>
      ctx.hand.cards.every((c) => c.suit === "spades" || c.suit === "clubs")
        ? { flatChips: 20, note: "Black Sheep +20 chips" }
        : null,
  },
  {
    id: "red-district",
    name: "Red District",
    text: "Commits using only red suits get +20 chips.",
    example: "All hearts and diamonds in the 2+3 — +20 chips.",
    onScore: (ctx) =>
      ctx.hand.cards.every((c) => c.suit === "hearts" || c.suit === "diamonds")
        ? { flatChips: 20, note: "Red District +20 chips" }
        : null,
  },
  {
    id: "even-steven",
    name: "Even Steven",
    text: "Two pair scores ×2 mult.",
    example: "Two pair doubles its mult.",
    onScore: (ctx) =>
      ctx.hand.category === "two_pair"
        ? { multMult: 2, note: "Even Steven ×2" }
        : null,
  },
  {
    id: "aces-up",
    name: "Aces Up",
    text: "Each ace in your committed hand adds +2 mult.",
    example: "Two aces committed — +4 mult.",
    onScore: (ctx) => {
      const aces = ctx.hand.cards.filter((c) => c.rank === 14).length;
      return aces
        ? { plusMult: 2 * aces, note: `Aces Up +${2 * aces} mult` }
        : null;
    },
  },
  {
    id: "sunk-cost",
    name: "Sunk Cost",
    text: "If you have 0 redraws left, +50 chips.",
    example: "Spent every redraw — commits now add +50 chips.",
    onScore: (ctx) =>
      ctx.redrawsLeft === 0
        ? { flatChips: 50, note: "Sunk Cost +50 chips" }
        : null,
  },
  {
    id: "deuces-wild-ish",
    name: "Deuce Bonus",
    text: "Each 2 in your committed hand adds +12 chips.",
    example: "A wheel with two deuces pays +24 chips.",
    onScore: (ctx) => {
      const twos = ctx.hand.cards.filter((c) => c.rank === 2).length;
      return twos
        ? { flatChips: 12 * twos, note: `Deuce Bonus +${12 * twos} chips` }
        : null;
    },
  },
];

export const RELIC_REGISTRY = new Map(RELICS.map((r) => [r.id, r]));

export const RELIC_SLOTS = 5;
