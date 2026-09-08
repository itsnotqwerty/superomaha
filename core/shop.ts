// Shop (spec §7.4 / REQ-ECON-2..3): 3 item slots, 1 pack slot, scaling reroll.
// Inventory is rolled from the seeded Rng at shop entry — no timing exploits.

import { HAND_TABLE, HandCategory } from "./evaluator.ts";
import { Modifier } from "./mods.ts";
import { RELIC_REGISTRY, RELICS } from "./relics.ts";
import { Rng } from "./rng.ts";
import { Voucher, VOUCHERS } from "./vouchers.ts";

export type ShopItem =
  | { kind: "relic"; relic: Modifier; price: number }
  | { kind: "leveler"; category: HandCategory; price: number };

export interface ShopState {
  items: (ShopItem | null)[]; // 3 slots, null = sold out
  pack: Pack | null; // 1 pack slot
  voucher: Voucher | null; // 1 voucher slot (from ante 2 onward)
  rerollCost: number;
}

export interface Pack {
  kind: "relic" | "hand-level";
  options: string[]; // relic ids or hand categories
  price: number;
}

const HAND_CATEGORIES = Object.keys(HAND_TABLE) as HandCategory[];

export function relicPrice(): number {
  return 6; // flat MVP price; balance sim tunes later
}

export function levelerPrice(): number {
  return 4;
}

export function packPrice(): number {
  return 8;
}

export class Shop {
  #rng: Rng;
  state: ShopState;

  constructor(
    seed: string,
    ownedRelicIds: string[],
    ownedVoucherIds: string[] = [],
    ante = 1,
  ) {
    this.#rng = new Rng(seed);
    this.state = {
      items: [null, null, null],
      pack: null,
      voucher: null,
      rerollCost: 2,
    };
    this.#rollItems(ownedRelicIds);
    this.#rollPack(ownedRelicIds);
    this.#rollVoucher(ownedVoucherIds, ante);
  }

  /** Vouchers appear from ante 2; never offers an owned voucher. */
  #rollVoucher(owned: string[], ante: number) {
    if (ante < 2) return;
    const pool = VOUCHERS.filter((v) => !owned.includes(v.id));
    if (!pool.length) return;
    if (this.#rng.next() < 0.5) {
      this.state.voucher = pool[this.#rng.int(pool.length)];
    }
  }

  #pickRelic(exclude: string[]): Modifier {
    const pool = RELICS.filter((r) => !exclude.includes(r.id));
    return pool.length
      ? pool[this.#rng.int(pool.length)]
      : RELICS[this.#rng.int(RELICS.length)];
  }

  #rollItems(ownedRelicIds: string[]) {
    const exclude = [...ownedRelicIds];
    this.state.items = this.state.items.map(() => {
      if (this.#rng.next() < 0.7) {
        const relic = this.#pickRelic(exclude);
        exclude.push(relic.id);
        return { kind: "relic", relic, price: relicPrice() };
      }
      const category = HAND_CATEGORIES[this.#rng.int(HAND_CATEGORIES.length)];
      return { kind: "leveler", category, price: levelerPrice() };
    });
  }

  #rollPack(ownedRelicIds: string[]) {
    if (this.#rng.next() < 0.5) {
      const options: string[] = [];
      const exclude = [...ownedRelicIds];
      for (let i = 0; i < 3; i++) {
        const relic = this.#pickRelic(exclude);
        options.push(relic.id);
        exclude.push(relic.id);
      }
      this.state.pack = { kind: "relic", options, price: packPrice() };
    } else {
      const pool = [...HAND_CATEGORIES];
      const options: string[] = [];
      for (let i = 0; i < 3; i++) {
        options.push(pool.splice(this.#rng.int(pool.length), 1)[0]);
      }
      this.state.pack = { kind: "hand-level", options, price: packPrice() };
    }
  }

  /** Buy item slot i. Returns the item, or null if unaffordable/empty. */
  buy(i: number, cash: number): { item: ShopItem; change: number } | null {
    const item = this.state.items[i];
    if (!item || cash < item.price) return null;
    this.state.items[i] = null;
    return { item, change: cash - item.price };
  }

  /** Buy the pack; caller picks one option from `pack.options`. */
  buyPack(cash: number): { pack: Pack; change: number } | null {
    if (!this.state.pack || cash < this.state.pack.price) return null;
    const pack = this.state.pack;
    this.state.pack = null;
    return { pack, change: cash - pack.price };
  }

  reroll(cash: number, ownedRelicIds: string[]): number | null {
    if (cash < this.state.rerollCost) return null;
    const change = cash - this.state.rerollCost;
    this.state.rerollCost++;
    this.#rollItems(ownedRelicIds);
    return change;
  }
}

/** Sell price for a relic (scope §15.5: selling must feel fair). */
export function relicSellPrice(): number {
  return 3;
}

export { RELIC_REGISTRY };
