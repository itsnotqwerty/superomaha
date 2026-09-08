# ROADMAP.md

# Super Omaha — Roadmap

**Source of truth:** [scope.md](scope.md) (§17 Phased delivery) · Contracts: [spec.md](spec.md) · [design.md](design.md)
**Status:** Draft v0.1

Team assumption: very small team (1 designer-engineer + optional artist) or solo. Evaluator correctness and relic text outrank illustration at every phase.

---

## Phase 0 — Spike (3–5 days)

Prove the identity of the game before building the game.

- [x] Omaha evaluator enumerating all 60 legal 2+3 combos ([core/evaluator.ts](../core/evaluator.ts))
- [x] One playable screen: deal 4 hole + 5 board, tap a legal hand, print classification ([islands/OmahaTable.tsx](../islands/OmahaTable.tsx))
- [x] Six hole-pair teaching tabs prototype
- [x] First golden tests: wheel straight, wrap-straight rejection, board-flush trap (14 tests in [core/evaluator_test.ts](../core/evaluator_test.ts))

**Exit criteria:** a non-poker player can see *which* two hole cards and *why* — the teaching loop works.

---

## Phase 1 — MVP (target: 6 weeks)

### Week 1–2 — Core loop
- [x] Seeded `Rng`; card/deal core ([core/rng.ts](../core/rng.ts), [core/cards.ts](../core/cards.ts))
- [x] Deal + legal-combo highlighter + six pair tabs
- [x] Chips × mult scoring via `ScoringPipeline` step list ([core/scoring.ts](../core/scoring.ts))
- [x] Antes 1–8 × three blinds via `Run` ([core/run.ts](../core/run.ts))
- [x] Commit gating + score animation with reduced-motion fallback (`ScoreTheater`)

### Week 3 — Economy
- [x] Shop: 3 item slots, 1 pack slot, reroll with scaling cost, sell relics ([core/shop.ts](../core/shop.ts))
- [x] 15 relics on the `Modifier` hook interface ([core/relics.ts](../core/relics.ts), [core/mods.ts](../core/mods.ts))
- [x] Hand-leveler consumables; money sources (payout, overkill, interest, leftovers)

### Week 4 — Run structure
- [x] 8 boss blinds ([core/bosses.ts](../core/bosses.ts)) — fixture-tested: legal play always exists on Classic
- [x] 4 starting tables ([core/tables.ts](../core/tables.ts)) with select on title screen; Double-Suited deals two suited pairs
- [x] Win at Ante 8 / lose on failed blind
- [x] Collection (seen relics/bosses/tables, [/collection](../routes/collection.tsx), [core/collection.ts](../core/collection.ts))

### Week 5 — Presentation & reach
- [x] Juice pass: score theater with step reveal + slam total
- [x] Portrait-first mobile layout (max-width 480px, tap targets)
- [x] Boss banner with one-line rule + ante-start preview
- [x] Daily seed (client-only)

### Week 6 — Hardening
- [x] Omaha-specific blind-target curve from frequency simulation ([core/sim.ts](../core/sim.ts))
- [x] Interactive tutorial (2+3 lesson + scoring lesson, [/tutorial](../routes/tutorial.tsx))
- [x] Evaluator trap tests (46 total); replay-log download for failed blinds
- [x] Refresh-safe save after every action ([core/persist.ts](../core/persist.ts))

### MVP done means
- [x] Guest starts a run in one click
- [x] Tutorial teaches 2+3; auto-best always on
- [x] Full Antes 1–8 with shops
- [x] Non-trivial winning builds exist (sim-verified: 3-relic synergy builds win early antes ~93%, bosses demand continued investment)
- [x] Playable on a phone-sized viewport
- [x] No paid power anywhere

---

## Phase 2 — Depth & accounts

- [x] Street-by-street boards (flop → turn → river): `streets` flag on `Blind`, Naked Board table uses it; `onStreet` relic hooks live (Turn Teller, River Boat, Street Smart)
- [x] Relic count 40/40 ([core/relics.ts](../core/relics.ts) — three waves, quality and legality interaction over count)
- [x] Vouchers / permanent-in-run ante upgrades ([core/vouchers.ts](../core/vouchers.ts): +1 play, +1 redraw, 6th relic slot, high interest — in shop from ante 2)
- [x] Endless mode past Ante 8 ([core/run.ts](../core/run.ts) `continueEndless`)
- [x] Auth + cloud save ([server/auth.ts](../server/auth.ts), [routes/api/save.ts](../routes/api/save.ts), [/account](../routes/account.tsx) — PostgreSQL via `DATABASE_URL`, schema in [db/schema.sql](../db/schema.sql))
- [x] Validated daily leaderboard ([server/validate.ts](../server/validate.ts) replays seed + action log through the rules core before accepting; [routes/api/leaderboard.ts](../routes/api/leaderboard.ts))
- [x] Cosmetics (felts + card backs unlocked by play milestones, never sold — [core/cosmetics.ts](../core/cosmetics.ts); store/monetization layer intentionally out per scope §12.4)
- [x] Reduced-motion + accessibility: suit letters + symbols (never color alone), full-name ARIA labels ("jack of hearts, in committed hand"), focus-visible outlines, reduced-motion theater fallback

## Phase 3 — Long tail

- [x] Endless number display ([core/numfmt.ts](../core/numfmt.ts) — scientific/B-suffix formatting; Number is exact to 2^53, beyond any realistic run)
- [x] Challenge seeds and stake-like difficulty modifiers ([core/stakes.ts](../core/stakes.ts): 4 stakes gated on wins, shareable `challenge-<tag>?stake=…&table=…` seeds)
- [x] Additional tables: Five-Card Omaha ([core/tables.ts](../core/tables.ts) `holeSize: 5`, still exactly 2 hole per hand); wild board and lowball still TODO
- [ ] Optional Pixi/Phaser scoring cinema (juice layer only)
- [ ] Localization
- [~] Live-ops: daily seeded run + validated leaderboard live; weekly named boss challenge TODO

---

## Decision gates (must close before hard implementation — scope.md §20)

| # | Question | Default assumption |
|---|---|---|
| 1 | Hole/board persistence model A/B/C | **A** (full redeal each play) |
| 2 | Full board vs streets in MVP | Full board |
| 3 | Redraw scope (hole, board, chosen) | Player-chosen, per table |
| 4 | Play consumes committed cards vs full redeal | Full redeal (with A) |
| 5 | Ace-low straights default | On |
| 6 | High card as scored play | Yes |
| 7 | Boss set validation | Cut any boss with zero legal plays on Classic |
| 8 | Title + art direction lock | Felt + neon, geometric/vector |
| 9–10 | Accounts / leaderboards at MVP | No / no (client-only daily) |
| 11 | Hide auto-best hard mode | Post-MVP |
| 12 | Interest rules / skip-blind-for-cash | Interest on; skip post-MVP |

---

## Success metrics (MVP targets)

| Metric | Target |
|---|---|
| Tutorial completion | ≥ 80% of first sessions |
| Second-run rate | ≥ 40% |
| Time to first Ante 2 | < 10 min median |
| Classic win rate (post-tutorial, 10+ runs) | 15–30% |
| Evaluator dispute reports | ~0 after week-6 patch |
| First interactive paint | < 2s mid-range mobile |

---

## Risk watchlist (standing)

- **Clone perception** → 2+3 always visible, original names/art
- **Hold'em instinct rage-quits** → auto-eval + pair tabs + tutorial
- **Trivial targets** → Omaha frequency sim before curve lock
- **Mobile unreadability** → portrait-first, tap panels, no hover-only info
- **Relic/legality bugs** → pipeline order + golden tests + replay log
- **Gambling-policy flags** → no cashier, no paid power, careful wording
- **Scope creep** → 15 relics / 8 bosses / 4 tables is the MVP ceiling
