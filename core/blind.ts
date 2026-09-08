// Blind state machine (spec §3, §4 / REQ-BLIND-1..5) with modifier hooks.
// Deal model Option A: fresh hole + board on every play; redraws replace
// player-selected cards from the blind's own shoe.

import { Card, makeDeck, Rank } from "./cards.ts";
import { evaluate, EvaluatedHand, EvaluateOptions } from "./evaluator.ts";
import { Modifier } from "./mods.ts";
import { Rng } from "./rng.ts";
import { HandLevels, legalityOf, scoreHand, ScoreResult } from "./scoring.ts";

export interface BlindConfig {
  target: number;
  plays: number; // default 3
  redraws: number; // default 2
  ranks?: Rank[]; // table-defined deck (e.g. short deck 6+)
  boss?: Modifier | null;
  /** Double-Suited table: hole deals as two suited pairs. */
  doubleSuited?: boolean;
  /** Streets mode: deal the full board but reveal flop → turn → river
   * between plays (scope §5.3 post-MVP; Option A persists each play). */
  streets?: boolean;
  /** Hole size (Five-Card Omaha table: 5). */
  holeSize?: number;
  /** Lowball (2-7) evaluation: lowest hand scores best. */
  lowball?: boolean;
  /** One random board seat per deal is wild (any rank). */
  wildBoard?: boolean;
}

export type BlindPhase = "playing" | "won" | "lost";

export interface BlindState {
  config: BlindConfig;
  hole: Card[];
  board: Card[];
  /** In streets mode, how many board cards are revealed (3, 4, or 5). */
  revealed: number;
  playsLeft: number;
  redrawsLeft: number;
  score: number;
  phase: BlindPhase;
  history: ScoreResult[];
}

export interface PlayContext {
  relics: Modifier[];
  handLevels?: HandLevels;
  cash?: number;
}

export class Blind {
  #rng: Rng;
  #shoe: Card[];
  #state: BlindState;
  #carryHole: Card | null = null; // sticky-ace
  #carryBoard: Card | null = null; // anchor
  #deadSuit: string | null = null; // boss-dead-suit, computed per deal
  #wildSeat: number | null = null; // wild-board table, chosen per deal
  #seed: string;

  constructor(seed: string, config: BlindConfig) {
    this.#seed = seed;
    this.#rng = new Rng(seed);
    this.#shoe = this.#rng.shuffle(makeDeck(config.ranks));
    this.#state = {
      config,
      hole: [],
      board: [],
      revealed: config.streets ? 3 : config.boss?.boardSize ?? 5,
      playsLeft: config.boss?.plays ?? config.plays,
      redrawsLeft: config.boss?.redraws ?? config.redraws,
      score: 0,
      phase: "playing",
      history: [],
    };
    this.#dealAll([]);
  }

  /** The current deal's legal combos under base legality (boss-only). */
  #hasLegalDeal(): boolean {
    return this.legalHands([]).length > 0;
  }

  get seed(): string {
    return this.#seed;
  }

  /** Serializable snapshot — cards are stored directly (persist.ts). */
  snapshot() {
    const s = this.#state;
    return {
      seed: this.#seed,
      hole: s.hole,
      board: s.board,
      shoe: [...this.#shoe],
      revealed: s.revealed,
      playsLeft: s.playsLeft,
      redrawsLeft: s.redrawsLeft,
      score: s.score,
      phase: s.phase,
      target: s.config.target,
    };
  }

  /** Restore a blind from a snapshot (no redeal — exact card state). */
  static restore(
    config: BlindConfig,
    snap: Omit<ReturnType<Blind["snapshot"]>, "revealed"> & {
      revealed?: number;
    },
  ): Blind {
    const blind = new Blind(snap.seed, config);
    blind.#shoe = [...snap.shoe];
    blind.#state = {
      config,
      hole: snap.hole,
      board: snap.board,
      revealed: snap.revealed ?? snap.board.length,
      playsLeft: snap.playsLeft,
      redrawsLeft: snap.redrawsLeft,
      score: snap.score,
      phase: snap.phase,
      history: [],
    };
    blind.#updateDeadSuit();
    return blind;
  }

  get state(): Readonly<BlindState> {
    return this.#state;
  }

  get rngCursor(): number {
    return this.#rng.cursor;
  }

  get boss(): Modifier | null {
    return this.#state.config.boss ?? null;
  }

  /** Suit banned on the board by boss-dead-suit, if active this deal. */
  get deadSuit(): string | null {
    return this.#deadSuit;
  }

  /** Merged legality for the current deal (boss + relics + table). */
  legality(relics: Modifier[]): EvaluateOptions & { forcePick?: number } {
    const mods = [...relics, ...(this.boss ? [this.boss] : [])];
    const base = legalityOf(mods);
    if (this.#state.config.lowball) base.lowball = true;
    if (this.#wildSeat !== null) base.wildSeats = [this.#wildSeat];
    if (this.#deadSuit) {
      const dead = this.#deadSuit;
      const prev = base.comboFilter;
      base.comboFilter = (h, b) =>
        b.every((c) => c.suit !== dead) && (prev ? prev(h, b) : true);
    }
    return base;
  }

  /** Every legal combo for the current deal, best-first. In streets mode,
   * only revealed board cards are usable. */
  legalHands(relics: Modifier[] = []): EvaluatedHand[] {
    const { forcePick: _fp, ...opts } = this.legality(relics);
    return evaluate(this.#state.hole, this.visibleBoard, opts);
  }

  /** The hand the commit button scores (forcePick bosses lock the choice). */
  defaultPick(relics: Modifier[] = []): EvaluatedHand | undefined {
    const hands = this.legalHands(relics);
    const fp = this.legality(relics).forcePick ?? 0;
    return hands[Math.min(fp, Math.max(0, hands.length - 1))];
  }

  #draw(): Card {
    const card = this.#shoe.pop();
    if (!card) throw new Error("shoe exhausted");
    return card;
  }

  /**
   * Hole deal. Double-Suited table: deal two cards of one suit and two of
   * another (like a double-suited PLO starting hand), drawn from the shoe.
   */
  #dealHole(): Card[] {
    const size = this.#state.config.holeSize ?? 4;
    if (!this.#state.config.doubleSuited) {
      return Array.from({ length: size }, () => this.#draw());
    }
    const pickSuitCard = (suit: string): Card => {
      const i = this.#shoe.findIndex((c) => c.suit === suit);
      if (i === -1) return this.#draw(); // suit exhausted in shoe
      return this.#shoe.splice(i, 1)[0];
    };
    const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
    const a = suits[this.#rng.int(4)];
    let b = suits[this.#rng.int(4)];
    if (b === a) b = suits[(suits.indexOf(a) + 1) % 4];
    return [
      pickSuitCard(a),
      pickSuitCard(a),
      pickSuitCard(b),
      pickSuitCard(b),
    ];
  }

  /**
   * Option A redeal with carry-over relics (sticky-ace keeps the highest
   * uncommitted hole card, anchor keeps the first board card). The boss
   * "short board" shrinks the board. If a deal has no legal play (possible
   * under comboFilter bosses), redeal — scope §8.5 brick-boss guard.
   */
  #dealAll(relics: Modifier[] | null) {
    const s = this.#state;
    const boardSize = this.boss?.boardSize ?? 5;

    for (let attempt = 0; attempt < 8; attempt++) {
      s.hole = this.#dealHole();
      s.board = Array.from({ length: boardSize }, () => this.#draw());
      s.revealed = s.config.streets ? 3 : boardSize;

      if (this.#carryHole) {
        s.hole[0] = this.#carryHole;
        this.#carryHole = null;
      }
      if (this.#carryBoard) {
        s.board[0] = this.#carryBoard;
        this.#carryBoard = null;
      }

      this.#updateDeadSuit();
      this.#updateWildSeat();
      if (relics === null || this.legalHands(relics).length > 0) return;
      // No legal play this deal — burn and redeal (never brick the player).
    }
  }

  /**
   * Streets mode (scope §5.3 post-MVP): reveal the turn/river between plays.
   * The full board is dealt deterministically up front; only visibility
   * changes. Returns false when not in streets mode or fully revealed.
   * Fires onStreet relic hooks (their deltas apply to this blind).
   */
  revealNextStreet(relics: Modifier[] = []): boolean {
    const s = this.#state;
    if (!s.config.streets || s.phase !== "playing") return false;
    if (s.revealed >= s.board.length) return false;
    s.revealed++;
    this.#updateDeadSuit();
    const street = s.revealed === 4 ? "turn" : "river";
    for (const mod of relics) {
      const d = mod.onStreet?.(street, this.visibleBoard);
      if (!d) continue;
      if (d.score) s.score += d.score;
      if (d.redraws) s.redrawsLeft += d.redraws;
    }
    return true;
  }

  /** The visible portion of the board (all of it outside streets mode). */
  get visibleBoard(): Card[] {
    return this.#state.board.slice(0, this.#state.revealed);
  }

  /** Wild-board table: pick a random revealed board seat as wild. */
  #updateWildSeat() {
    this.#wildSeat = null;
    if (!this.#state.config.wildBoard) return;
    this.#wildSeat = this.#rng.int(this.#state.board.length);
  }

  /** The wild board seat this deal, if any. */
  get wildSeat(): number | null {
    return this.#wildSeat;
  }

  /** boss-dead-suit: ban the most common suit currently on the board. */
  #updateDeadSuit() {
    this.#deadSuit = null;
    if (this.boss?.id !== "boss-dead-suit") return;
    const counts = new Map<string, number>();
    for (const c of this.visibleBoard) {
      counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1);
    }
    let best: string | null = null;
    let n = 0;
    for (const [suit, count] of counts) {
      if (count > n) {
        n = count;
        best = suit;
      }
    }
    this.#deadSuit = best;
  }

  /**
   * Redraw (REQ-BLIND-4): replace the selected hole/board card indices.
   * Replaced cards are burned for this blind.
   */
  redraw(
    holeIdx: number[],
    boardIdx: number[],
    relics: Modifier[] = [],
  ): boolean {
    const s = this.#state;
    if (s.phase !== "playing" || s.redrawsLeft <= 0) return false;
    if (holeIdx.length + boardIdx.length === 0) return false;
    if (holeIdx.some((i) => i < 0 || i >= s.hole.length)) return false;
    if (boardIdx.some((i) => i < 0 || i >= s.board.length)) return false;

    for (const i of holeIdx) s.hole[i] = this.#draw();
    for (const i of boardIdx) s.board[i] = this.#draw();
    s.redrawsLeft--;
    this.#updateDeadSuit();

    // Brick guard: a redraw must not leave zero legal plays.
    if (this.legalHands(relics).length === 0) {
      this.#dealAll(relics);
    }
    return true;
  }

  /**
   * Commit a play (REQ-BLIND-2/3): score through the pipeline, decrement
   * plays, resolve won/lost, and redeal (with carry-overs) if continuing.
   * Double Dip: the second-best legal combo also scores at half value.
   */
  play(hand: EvaluatedHand, ctx: PlayContext): ScoreResult | null {
    const s = this.#state;
    if (s.phase !== "playing" || s.playsLeft <= 0) return null;

    const scoreOpts = {
      relics: ctx.relics,
      boss: this.boss,
      handLevels: ctx.handLevels,
      hole: s.hole,
      board: this.visibleBoard,
      cash: ctx.cash ?? 0,
      playsLeftAfter: s.playsLeft - 1,
      redrawsLeft: s.redrawsLeft,
    };

    const result = scoreHand(hand, scoreOpts);
    s.history.push(result);
    s.score += result.total;

    // double-dip: second-best legal combo at half value.
    if (ctx.relics.some((r) => r.id === "double-dip")) {
      const hands = this.legalHands(ctx.relics);
      if (hands.length > 1) {
        const other = hands[0] === hand ? hands[1] : hands[0];
        const dip = scoreHand(other, scoreOpts);
        const half = Math.floor(dip.total / 2);
        s.score += half;
        s.history.push({ ...dip, total: half });
      }
    }

    s.playsLeft--;

    // Carry-over relics snapshot before redeal.
    if (ctx.relics.some((r) => r.id === "sticky-ace")) {
      this.#carryHole = s.hole.reduce((a, b) => (a.rank >= b.rank ? a : b));
    }
    if (ctx.relics.some((r) => r.id === "anchor")) {
      this.#carryBoard = s.board[0];
    }

    if (s.score >= s.config.target) {
      s.phase = "won";
    } else if (s.playsLeft === 0) {
      s.phase = "lost";
    } else if (s.config.streets && this.revealNextStreet(ctx.relics)) {
      // Streets mode: reveal turn/river; same hole persists this street.
    } else {
      this.#dealAll(ctx.relics); // river already out (or no streets): redeal
    }
    return result;
  }
}
