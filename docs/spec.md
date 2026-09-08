# SPEC.md

# Super Omaha — Functional Specification

**Source of truth:** [scope.md](scope.md)
**Status:** Draft v0.1 (derived from Scope v0.1)
**Platform:** Free-to-play browser game (desktop + mobile web, PWA)

This document specifies **what the software does** in testable, implementable terms. Design rationale lives in scope.md; architecture lives in [design.md](design.md).

---

## 1. Definitions

| Term | Meaning |
|---|---|
| **Run** | One full play session: Antes 1–8, ending in a win or a failed blind. |
| **Ante** | Difficulty tier (1–8). Each ante is Small Blind → Big Blind → Boss Blind. |
| **Blind** | One round with a score target, a play budget, and a redraw budget. |
| **Hole** | The player's 4 private cards. |
| **Board** | The 5 shared cards. |
| **Play** | Committing one legal 2+3 combination for score. |
| **Redraw** | Replacing selected hole and/or board cards (per table rules). |
| **Relic** | A persistent run modifier (max 5 slots by default). |
| **Legal combo** | Exactly 2 hole cards + exactly 3 board cards, unless a relic/boss modifies legality. |

---

## 2. Core invariant

**REQ-INV-1:** Every scored hand is constructed from exactly 2 hole cards and exactly 3 board cards. "Playing the board" is never legal. Using 1 or 3 hole cards is illegal unless a relic or boss rule explicitly rewrites construction.

**REQ-INV-2:** The evaluator enumerates all `C(4,2) × C(5,3) = 60` candidate combinations (fewer when legality is modified) and returns the best by hand rank, then standard poker kickers among the 5 scored cards.

**REQ-INV-3:** Rules code must never call `Math.random()`. All randomness comes from the seeded `Rng` module. Same seed + same action sequence = identical cards, shop, and outcomes.

---

## 3. Deal model

**Decision status:** Option A (per scope.md §5.3) is the MVP default. This spec is written for Option A; if design locks B or C, sections 3–5 must be revised.

**REQ-DEAL-1:** On each play within a blind, deal a fresh 4-card hole and a fresh 5-card board from a single 52-card shoe (no card appears in both hole and board).

**REQ-DEAL-2:** MVP deals the full 5-card board at once. Street-by-street dealing (flop/turn/river) is post-MVP.

**REQ-DEAL-3:** Redraws replace player-selected hole and/or board cards, subject to per-table redraw scope (§10.4). Cards replaced are burned for that blind (no immediate redraw of the same card).

---

## 4. Blind lifecycle

**REQ-BLIND-1:** Each blind has: a target score, `plays` (default 3), `redraws` (default 2), and zero or one boss modifier.

**REQ-BLIND-2:** A play commits a legal combo; its score is added to the blind's cumulative score. Plays decrement to 0.

**REQ-BLIND-3:** The blind is **won** when cumulative score ≥ target. The blind is **lost** when plays reach 0 and cumulative score < target. Losing a blind ends the run.

**REQ-BLIND-4:** A redraw consumes 1 redraw and re-deals the selected cards. Redraws are per-blind and do not carry over unless a relic says otherwise.

**REQ-BLIND-5:** On blind win: award money (§7), transition to the shop (except after a Boss Blind, where the ante increments and the next boss modifier is previewed).

---

## 5. Scoring pipeline (mandatory, ordered, testable)

**REQ-SCORE-1:** Scoring executes in exactly this order:

1. Apply legality modifiers (relics, boss rules).
2. Enumerate all legal 2+3 (or modified-shape) combinations.
3. Classify each combo's hand type.
4. Sum card chips of the committed cards.
5. Apply on-card modifiers (foil/steel/stone/holo effects).
6. Apply relic flat chips / +mult / ×mult in relic slot order.
7. Apply after-score triggers (e.g., "if unused hole cards…" effects).
8. Write every step to the replay log.

**REQ-SCORE-2:** Final score formula:

```
hand_score = (hand_base_chips + card_chips + relic_flat_chips)
             × (hand_base_mult + relic_plus_mult)
             × relic_mult_mult
             + delayed/trigger effects
```

**REQ-SCORE-3:** The UI displays the score as a left-to-right animated equation. A reduced-motion fallback shows the final values instantly.

**REQ-SCORE-4:** MVP hand table (tuning values, subject to balance):

| Hand | Base chips | Base mult |
|---|---|---|
| High card | 5 | 1 |
| Pair | 10 | 2 |
| Two pair | 20 | 2 |
| Three of a kind | 30 | 3 |
| Straight | 30 | 4 |
| Flush | 35 | 4 |
| Full house | 40 | 4 |
| Four of a kind | 60 | 7 |
| Straight flush | 100 | 8 |

Royal flush scores as a straight flush at MVP.

**REQ-SCORE-5:** Ace-low straights (A-2-3-4-5) are enabled by default unless a modifier forbids them. *(Open question #5 in scope.md — confirm before lock.)*

**REQ-SCORE-6:** High card is a legal scored play.

**REQ-SCORE-7:** Scores in Endless mode must not overflow; use arbitrary-precision integers or scientific-notation display above a threshold.

---

## 6. Evaluator UX

**REQ-EVAL-1:** The UI always highlights the current best legal combo automatically.

**REQ-EVAL-2:** Six hole-pair tabs (`C(4,2)`) are displayed so players can inspect each pairing; the best pairing is marked. Tabs are swipeable on mobile.

**REQ-EVAL-3:** Manual override: the player may commit any legal combo, not only the best.

**REQ-EVAL-4:** The commit button is enabled only when the selection forms a currently-legal shape, with a persistent counter: `Hole 2/2 · Board 3/3`.

---

## 7. Economy

**REQ-ECON-1:** Money is earned from: blind payouts, overkill score (capped), unused plays/redraws (table-dependent), interest above a cash threshold, and relic triggers.

**REQ-ECON-2:** Shop contains: 3 item slots (relics/consumables), 1 pack slot, 1 reroll button with per-shop scaling cost.

**REQ-ECON-3:** Relic cap is 5 slots. Relics can be sold at a fair price to free slots.

**REQ-ECON-4:** Nothing purchasable with real money affects run power (no paid plays, redraws, slots, or relics). No energy/stamina gates. No power loot boxes.

---

## 8. Run structure

**REQ-RUN-1:** A run is Antes 1–8; each ante is Small Blind → Big Blind → Boss Blind, with a shop after each won blind.

**REQ-RUN-2:** Boss modifiers are previewed at ante start. Every boss must guarantee at least one legal play on a default Classic table with no relics.

**REQ-RUN-3:** Winning the Ante 8 Boss Blind completes the run. Endless mode (score chase) unlocks after the first win and requires no meta unlocks.

**REQ-RUN-4:** Session pacing targets: tutorial + first blind < 3 min; first ante ~4–6 min; first win 12–20 min; strong run ≤ 40 min.

---

## 9. Tutorial

**REQ-TUT-1:** First screen teaches the 2+3 rule interactively using the canonical example (Board: `A♠ K♠ 9♥ 4♣ 2♦`, Hole: `A♥ A♦ 7♠ 6♠`): a pair of aces is not automatic; the player picks which two hole cards; the six pairings are shown; the best legal combo is highlighted.

**REQ-TUT-2:** Second screen teaches chips × mult, plays vs target, and the shop.

**REQ-TUT-3:** No hand-ranking wall of text; the auto-evaluator is always on at MVP.

---

## 10. Content requirements (MVP counts)

**REQ-CONTENT-1:** **15 relics**, all interacting with Omaha structure (hole selection, board state, or the 2+3 rule). Each relic's text is one sentence plus one example.

**REQ-CONTENT-2:** **8 boss blinds**, one readable rule twist each, drawn from the scope list (same-suit commit, 4-card board, no flushes, face-down hole, dead suit, redraw tax, second-best-combo scoring, and one additional validated twist). Any boss that can produce zero legal hands on Classic is cut or redesigned.

**REQ-CONTENT-3:** **4 starting tables**, unlocked by play (never cash): Classic (52 cards, 3 plays, 2 redraws), Double-suited, Short deck (36 cards, 6+), Naked board.

**REQ-CONTENT-4:** Consumables: Streets (one-shot board manipulators), Hand levelers (permanent per-run base chip/mult increase per hand type — 8 items), Card mods (foil/steel/stone/holo, applicable to ranks or board seats).

**REQ-CONTENT-5:** Packs: draft 3–5 options, pick 1 (2 with a voucher). Types: Relic, Street, Hand-level, Mod.

---

## 11. Meta progression

**REQ-META-1:** First win must be achievable on Classic with tutorial relics only; no meta unlock gates run power.

**REQ-META-2:** Cross-run meta: collection of seen relics/bosses/tables, table unlocks, cosmetics, challenge seeds, optional difficulty stakes after first win.

---

## 12. UX requirements

**REQ-UX-1:** Two visual groups always: HOLE (4) with committed 2 highlighted; BOARD (5) with committed 3 highlighted. Unused cards dim; relics that care about unused cards ping them.

**REQ-UX-2:** Mobile is first-class: one-handed portrait, large hit targets, tap-toggle commit with counter, no hover-only information, shop usable at 390×844 without horizontal scroll.

**REQ-UX-3:** Always visible: target score, current score, plays, redraws, cash. Relic row shows icons with tap-for-full-text.

**REQ-UX-4:** Accessibility: suits signaled by pip + letter + shape (never color alone); screen-reader labels for cards and "legal combo"; desktop keyboard navigation; sufficient contrast; reduced-motion option.

---

## 13. Persistence

**REQ-SAVE-1:** Run state, settings, collection, and guest profile persist in localStorage/IndexedDB after every action. Refresh must never destroy an in-progress blind.

**REQ-SAVE-2:** Cloud save exists only after auth (post-MVP).

---

## 14. Acceptance tests (from scope.md §13.6 and §23)

- Golden tests for hand classification: wrap straights, wheel (A-2-3-4-5), flush+pair full house, board-paired quads with 2 hole kickers.
- Golden tests for 2+3 traps: a board flush is not a flush unless two hole cards suit it.
- Relic interaction fixtures.
- Boss fixtures: every boss has a legal play on Classic with no relics.
- Replay log downloadable for any failed blind (debug).
- Determinism test: same seed + actions = identical run.

---

## 15. Explicit non-requirements

Multiplayer, real-money anything, simulated betting, energy gates, power gacha, native apps at MVP, UGC/economy, narrative campaign, 3D/physics presentation, user accounts at MVP, public leaderboards at MVP.
