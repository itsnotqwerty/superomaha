// Vouchers (scope §8.6): permanent-in-run passives, sold in the shop.
// Kept deliberately small — each is one readable rule change.

export interface Voucher {
  id: string;
  name: string;
  text: string;
  example: string;
  price: number;
}

export const VOUCHERS: Voucher[] = [
  {
    id: "extra-play",
    name: "Extra Play",
    text: "+1 play on every blind for the rest of the run.",
    example: "Blinds open with plays 4 instead of 3.",
    price: 10,
  },
  {
    id: "extra-redraw",
    name: "Extra Redraw",
    text: "+1 redraw on every blind for the rest of the run.",
    example: "Blinds open with redraws 3 instead of 2.",
    price: 8,
  },
  {
    id: "sixth-slot",
    name: "Sixth Slot",
    text: "+1 relic slot (up to 6).",
    example: "Carry six relics into the boss.",
    price: 12,
  },
  {
    id: "high-interest",
    name: "High Interest",
    text: "Interest pays $1 per $5 held instead of per $10.",
    example: "Hold $25 at a blind win — earn $5 interest instead of $2.",
    price: 8,
  },
];

export const VOUCHER_REGISTRY = new Map(VOUCHERS.map((v) => [v.id, v]));
