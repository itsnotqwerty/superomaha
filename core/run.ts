// Run structure (spec §8 / REQ-RUN-1..4): Antes 1–8, each
// Small Blind → Big Blind → Boss Blind → shop. Owns cash, relics,
// hand levels, and the per-run collection.

import { Blind } from "./blind.ts";
import { bossForAnte } from "./bosses.ts";
import { HandCategory } from "./evaluator.ts";
import { Modifier } from "./mods.ts";
import { RunSnapshot } from "./persist.ts";
import { RELIC_REGISTRY, RELIC_SLOTS } from "./relics.ts";
import { HandLevels } from "./scoring.ts";
import { relicSellPrice, Shop, ShopItem } from "./shop.ts";
import { Stake, STAKE_REGISTRY } from "./stakes.ts";
import { DEFAULT_TABLE, TableConfig } from "./tables.ts";

export type BlindKind = "small" | "big" | "boss";

export interface RunState {
  ante: number; // 1..8 to win; endless keeps counting up
  blindIndex: number; // 0=small, 1=big, 2=boss
  phase: "playing" | "shop" | "won" | "lost";
  cash: number;
  relicIds: string[];
  handLevels: HandLevels;
  tableId: string;
  voucherIds: string[];
  /** Endless: keep playing past Ante 8 (score chase; spec §7.1). */
  endless: boolean;
}

export type Action =
  | { type: "play"; holeIdx: number[]; boardIdx: number[] }
  | { type: "redraw"; holeIdx: number[]; boardIdx: number[] }
  | { type: "settle" }
  | { type: "leaveShop" }
  | { type: "buyItem"; slot: number }
  | { type: "buyPack"; option: string }
  | { type: "buyVoucher" }
  | { type: "sellRelic"; index: number }
  | { type: "reroll" };

function sameIdx(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export const BLIND_KINDS: BlindKind[] = ["small", "big", "boss"];

/**
 * Blind target curve, derived from core/sim.ts (frequency sim).
 * Base-strategy (no relics) win rate degrades 98% → 0% across antes; a
 * mid-run relic build (3 synergies + levels) wins small blinds ~93% at ante 4
 * and ~39% at ante 8, with bosses at 48% → 3% — the curve that forces shop
 * investment without bricking early antes. Re-run sims after balance changes.
 */
export function blindTarget(
  ante: number,
  kind: BlindKind,
  table: TableConfig = DEFAULT_TABLE,
  stake?: { targetMult: number },
): number {
  const base = 300 + 150 * (ante - 1);
  const factor = kind === "small" ? 1 : kind === "big" ? 1.35 : 1.6;
  // Endless: keep scaling linearly past ante 8.
  return Math.round(
    base * factor * (table.targetMult ?? 1) * (stake?.targetMult ?? 1),
  );
}

/** Base payout for beating a blind (spec §7). */
export function blindPayout(kind: BlindKind): number {
  return kind === "small" ? 3 : kind === "big" ? 4 : 5;
}

export class Run {
  #seed: string;
  #state: RunState;
  #blind: Blind;
  #shop: Shop | null = null;
  #table: TableConfig;
  #stake: Stake = STAKE_REGISTRY.get("base")!;
  #log: Action[] = [];

  get seed(): string {
    return this.#seed;
  }

  /** The recorded action log (replay validation, scope §16). */
  get actionLog(): readonly Action[] {
    return this.#log;
  }

  constructor(
    seed: string,
    table: TableConfig = DEFAULT_TABLE,
    stake: Stake = STAKE_REGISTRY.get("base")!,
  ) {
    this.#seed = seed;
    this.#table = table;
    this.#stake = stake;
    // #state must exist before #makeBlind (it reads voucherIds).
    this.#state = {
      ante: 1,
      blindIndex: 0,
      phase: "playing",
      cash: 4,
      relicIds: [],
      handLevels: {},
      tableId: table.id,
      voucherIds: [],
      endless: false,
    };
    this.#blind = this.#makeBlind(1, "small");
  }

  get state(): Readonly<RunState> {
    return this.#state;
  }

  get blind(): Blind {
    return this.#blind;
  }

  get shop(): Shop | null {
    return this.#shop;
  }

  get table(): TableConfig {
    return this.#table;
  }

  get stake(): Stake {
    return this.#stake;
  }

  get kind(): BlindKind {
    return BLIND_KINDS[this.#state.blindIndex];
  }

  get relics(): Modifier[] {
    return this.#state.relicIds
      .map((id) => RELIC_REGISTRY.get(id))
      .filter((r): r is Modifier => !!r);
  }

  /** The boss previewed for the current ante (spec REQ-RUN-2). */
  get currentBoss(): Modifier {
    return bossForAnte(this.#state.ante);
  }

  /** All content seen this run, for the cross-run collection. */
  get seen(): { relicIds: string[]; bossIds: string[]; tableId: string } {
    // Bosses are on a fixed schedule; reaching ante N means bosses 1..N were
    // previewed and N-1 were fought.
    const bossIds: string[] = [];
    for (let a = 1; a <= this.#state.ante; a++) bossIds.push(bossForAnte(a).id);
    return {
      relicIds: [...this.#state.relicIds],
      bossIds,
      tableId: this.#table.id,
    };
  }

  #makeBlind(ante: number, kind: BlindKind): Blind {
    const v = this.#state.voucherIds;
    return new Blind(`${this.#seed}@ante${ante}-${kind}`, {
      target: blindTarget(ante, kind, this.#table, this.#stake),
      plays: this.#table.plays + (v.includes("extra-play") ? 1 : 0) +
        (this.#stake.playDelta ?? 0),
      redraws: this.#table.redraws + (v.includes("extra-redraw") ? 1 : 0) +
        (this.#stake.redrawDelta ?? 0),
      ranks: this.#table.ranks(),
      boss: kind === "boss" ? bossForAnte(ante) : null,
      doubleSuited: this.#table.doubleSuited,
      streets: this.#table.streets,
      holeSize: this.#table.holeSize,
      lowball: this.#table.lowball,
      wildBoard: this.#table.wildBoard,
    });
  }

  /** Active relic slot cap (Sixth Slot voucher). */
  get relicCap(): number {
    return RELIC_SLOTS +
      (this.#state.voucherIds.includes("sixth-slot") ? 1 : 0);
  }

  /** Context for Blind.play(). */
  playContext() {
    return {
      relics: this.relics,
      handLevels: this.#state.handLevels,
      cash: this.#state.cash,
    };
  }

  /**
   * Recorded play: commits the combo at the given hole/board indices and
   * appends it to the action log (replay validation).
   */
  commitPlay(holeIdx: number[], boardIdx: number[]): boolean {
    const s = this.#state;
    if (s.phase !== "playing") return false;
    const hands = this.#blind.legalHands(this.relics);
    const hand = hands.find(
      (h) => sameIdx(h.holeIdx, holeIdx) && sameIdx(h.boardIdx, boardIdx),
    ) ?? this.#blind.defaultPick(this.relics);
    if (!hand) return false;
    this.#log.push({ type: "play", holeIdx, boardIdx });
    return this.#blind.play(hand, this.playContext()) !== null;
  }

  /** Recorded redraw. */
  commitRedraw(holeIdx: number[], boardIdx: number[]): boolean {
    if (this.#state.phase !== "playing") return false;
    if (!this.#blind.redraw(holeIdx, boardIdx, this.relics)) return false;
    this.#log.push({ type: "redraw", holeIdx, boardIdx });
    return true;
  }

  /**
   * Resolve the finished blind: payout + overkill bonus (capped) +
   * leftover plays/redraws bonus + interest (scope §7.3), then open shop.
   */
  settle(): boolean {
    const s = this.#state;
    const bs = this.#blind.state;
    if (bs.phase === "playing") return false;
    if (bs.phase === "lost") {
      s.phase = "lost";
      return false;
    }
    this.#log.push({ type: "settle" });

    let earnings = blindPayout(this.kind) + (this.#table.bonusPayout ?? 0);
    earnings += Math.min(3, Math.floor((bs.score - bs.config.target) / 50)); // overkill
    earnings += bs.playsLeft + bs.redrawsLeft; // leftovers
    // High Interest voucher doubles the interest rate.
    const interestRate = s.voucherIds.includes("high-interest") ? 5 : 10;
    earnings += Math.floor(s.cash / interestRate);
    s.cash += earnings;

    // Shop after every won blind (spec §7.1).
    s.phase = "shop";
    this.#shop = new Shop(
      `${this.#seed}@shop-ante${s.ante}-${this.kind}`,
      s.relicIds,
      s.voucherIds,
      s.ante,
    );
    return true;
  }

  /** Leave the shop and start the next blind. */
  leaveShop(): boolean {
    const s = this.#state;
    if (s.phase !== "shop") return false;
    this.#log.push({ type: "leaveShop" });

    if (this.kind === "boss") {
      if (s.ante === 8 && !s.endless) {
        s.phase = "won";
        this.#shop = null;
        return false;
      }
      s.ante++;
      s.blindIndex = 0;
    } else {
      s.blindIndex++;
    }

    this.#blind = this.#makeBlind(s.ante, this.kind);
    this.#shop = null;
    s.phase = "playing";
    return true;
  }

  /** Opt into endless mode after beating Ante 8 (spec §7.1 Endless). */
  continueEndless(): boolean {
    const s = this.#state;
    if (s.phase !== "won" || s.endless) return false;
    s.endless = true;
    s.phase = "shop";
    s.ante = 9;
    s.blindIndex = 0;
    this.#shop = new Shop(
      `${this.#seed}@shop-ante9-endless`,
      s.relicIds,
      s.voucherIds,
      9,
    );
    return true;
  }

  // ---- Shop actions (all return false when illegal) ----

  buyItem(slot: number): boolean {
    const s = this.#state;
    if (!this.#shop) return false;
    const result = this.#shop.buy(slot, s.cash);
    if (!result) return false;
    this.#log.push({ type: "buyItem", slot });
    return this.#acquire(result.item, result.change);
  }

  buyPackOption(option: string): boolean {
    const s = this.#state;
    if (!this.#shop) return false;
    const pack = this.#shop.state.pack;
    if (!pack || !pack.options.includes(option)) return false;
    const result = this.#shop.buyPack(s.cash);
    if (!result) return false;
    this.#log.push({ type: "buyPack", option });
    const item: ShopItem = pack.kind === "relic"
      ? { kind: "relic", relic: RELIC_REGISTRY.get(option)!, price: 0 }
      : { kind: "leveler", category: option as HandCategory, price: 0 };
    return this.#acquire(item, result.change);
  }

  rerollShop(): boolean {
    const s = this.#state;
    if (!this.#shop) return false;
    const change = this.#shop.reroll(s.cash, s.relicIds);
    if (change === null) return false;
    this.#log.push({ type: "reroll" });
    s.cash = change;
    return true;
  }

  /** Buy the shop's voucher offer, if present and unowned. */
  buyVoucher(): boolean {
    const s = this.#state;
    const offer = this.#shop?.state.voucher;
    if (!this.#shop || !offer || s.voucherIds.includes(offer.id)) return false;
    if (s.cash < offer.price) return false;
    s.cash -= offer.price;
    s.voucherIds.push(offer.id);
    this.#shop.state.voucher = null;
    this.#log.push({ type: "buyVoucher" });
    return true;
  }

  sellRelic(index: number): boolean {
    const s = this.#state;
    if (index < 0 || index >= s.relicIds.length) return false;
    s.relicIds.splice(index, 1);
    s.cash += relicSellPrice();
    this.#log.push({ type: "sellRelic", index });
    return true;
  }

  #acquire(item: ShopItem, change: number): boolean {
    const s = this.#state;
    if (item.kind === "relic") {
      if (s.relicIds.length >= this.relicCap) return false; // sell first
      s.relicIds.push(item.relic.id);
    } else {
      const c = item.category;
      s.handLevels[c] = (s.handLevels[c] ?? 0) + 1;
    }
    s.cash = change;
    return true;
  }

  // ---- Persistence (REQ-SAVE-1) ----

  snapshot(): RunSnapshot {
    const s = this.#state;
    return {
      version: 1,
      seed: this.#seed,
      tableId: this.#table.id,
      ante: s.ante,
      blindIndex: s.blindIndex,
      phase: s.phase,
      cash: s.cash,
      relicIds: [...s.relicIds],
      handLevels: { ...s.handLevels },
      voucherIds: [...s.voucherIds],
      endless: s.endless,
      blind: this.#blind.snapshot(),
    };
  }

  static restore(snap: RunSnapshot, table: TableConfig): Run {
    const run = new Run(snap.seed, table);
    run.#state = {
      ante: snap.ante,
      blindIndex: snap.blindIndex,
      phase: snap.phase,
      cash: snap.cash,
      relicIds: [...snap.relicIds],
      handLevels: { ...snap.handLevels },
      tableId: table.id,
      voucherIds: [...(snap.voucherIds ?? [])],
      endless: snap.endless ?? false,
    };
    run.#shop = snap.phase === "shop"
      ? new Shop(
        `${snap.seed}@shop-ante${snap.ante}-${BLIND_KINDS[snap.blindIndex]}`,
        snap.relicIds,
        snap.voucherIds ?? [],
        snap.ante,
      )
      : null;
    const kind = BLIND_KINDS[snap.blindIndex];
    run.#blind = Blind.restore({
      target: snap.blind.target,
      plays: table.plays,
      redraws: table.redraws,
      ranks: table.ranks(),
      boss: kind === "boss" ? bossForAnte(snap.ante) : null,
      doubleSuited: table.doubleSuited,
      streets: table.streets,
      holeSize: table.holeSize,
      lowball: table.lowball,
      wildBoard: table.wildBoard,
    }, snap.blind);
    return run;
  }
}

export { RELIC_SLOTS };
