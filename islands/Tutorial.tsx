// One-screen Omaha lesson (spec §9 / REQ-TUT-1) with the canonical example:
// Board A♠ K♠ 9♥ 4♣ 2♦ · Hole A♥ A♦ 7♠ 6♠. Teaches: a pair of aces is not
// automatic — you pick WHICH TWO hole cards, and the game shows the best.
import { useMemo, useState } from "preact/hooks";
import { Card, cardLabel } from "../core/cards.ts";
import {
  bestByHolePair,
  evaluateOmaha,
  HAND_TABLE,
} from "../core/evaluator.ts";

const HOLE: Card[] = [
  { rank: 14, suit: "hearts" },
  { rank: 14, suit: "diamonds" },
  { rank: 7, suit: "spades" },
  { rank: 6, suit: "spades" },
];
const BOARD: Card[] = [
  { rank: 14, suit: "spades" },
  { rank: 13, suit: "spades" },
  { rank: 9, suit: "hearts" },
  { rank: 4, suit: "clubs" },
  { rank: 2, suit: "diamonds" },
];

function keyOf(pair: string, h: { boardIdx: number[] }) {
  return `${pair}-${h.boardIdx.join(".")}`;
}

export default function Tutorial() {
  const all = useMemo(() => evaluateOmaha(HOLE, BOARD), []);
  const best = all[0];
  const bestPairKey = best.holeIdx.join(",");
  const byPair = useMemo(() => bestByHolePair(HOLE, BOARD), []);
  const [picked, setPicked] = useState<string | null>(null);

  const selected = picked
    ? all.find((h) => keyOf(h.holeIdx.join(","), h) === picked) ?? best
    : best;

  return (
    <div class="table tutorial">
      <h2>Omaha in one screen</h2>
      <p>
        You hold <strong>four</strong> hole cards, but a hand uses{" "}
        <strong>exactly 2 of them</strong> plus <strong>exactly 3</strong>{" "}
        board cards. No exceptions.
      </p>

      <div class="row-label">BOARD</div>
      <div class="row">
        {BOARD.map((card, i) => (
          <span
            key={i}
            class={`card static ${
              selected.boardIdx.includes(i) ? "committed" : "dimmed"
            }`}
          >
            {cardLabel(card)}
          </span>
        ))}
      </div>

      <div class="row-label">HOLE</div>
      <div class="row">
        {HOLE.map((card, i) => (
          <span
            key={i}
            class={`card static ${
              selected.holeIdx.includes(i) ? "committed" : "dimmed"
            }`}
          >
            {cardLabel(card)}
          </span>
        ))}
      </div>

      <p>
        You have two aces — but the pair alone isn't your hand. Tap each pairing
        and watch what it actually makes:
      </p>

      <nav class="pair-tabs" aria-label="try each pairing">
        {[...byPair.keys()].map((key) => {
          const h = byPair.get(key)!;
          const k = keyOf(key, h);
          const isBest = key === bestPairKey;
          return (
            <button
              key={key}
              type="button"
              class={`pair-tab${picked === k ? " selected" : ""}${
                isBest ? " best" : ""
              }`}
              onClick={() => setPicked(k)}
            >
              {h.holeIdx.map((i) => cardLabel(HOLE[i])).join(" ")}
              <span class="pair-cat">
                {h.category.replaceAll("_", " ")}
                {isBest ? " ★ best" : ""}
              </span>
            </button>
          );
        })}
      </nav>

      <div class="score-line">
        Best play: <strong>{selected.category.replaceAll("_", " ")}</strong> —
        {" "}
        {HAND_TABLE[selected.category].chips} chips ×{" "}
        {HAND_TABLE[selected.category].mult} mult ={" "}
        <strong>
          {HAND_TABLE[selected.category].chips *
            HAND_TABLE[selected.category].mult}
        </strong>{" "}
        before card chips. A♥ A♦ together make three aces with the board's A♠.
      </div>

      <p>
        In a run, chips × mult race toward the blind's target before your plays
        run out. Win the blind, spend your payout in the shop, beat 8 antes.
      </p>

      <a class="commit tutorial-back" href="/">Play</a>
    </div>
  );
}
