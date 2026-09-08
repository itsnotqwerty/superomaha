# SCOPE.md

# Omaha Roguelite Card Game — Project Scope

**Working title:** TBD (candidates: *Omaha Ante*, *Four-Hole*, *The Flop Pit*, *Double Hole*, *Pot of Fools*)  
**Document type:** Product + design + engineering scope  
**Status:** Draft v0.1  
**Platform:** Free-to-play browser game (desktop + mobile web, PWA)  
**Genre:** Single-player Omaha-inspired poker roguelite / score-attack deck modifier  
**Inspiration (not a clone):** Balatro’s run loop, score theater, and relic synergies; Omaha Hold’em’s 2+3 hand construction  

This document captures **what we are building**, **what we are not building**, and **every concern that can sink the project** if ignored.

---

## 1. Vision

A short-session web game where the player beats escalating score blinds by constructing **Omaha hands** (exactly two hole cards + exactly three board cards), then buys **powers that cheat that rule**. The fantasy is not “play poker.” The fantasy is “break Omaha until a board becomes a scoring engine.”

**One-sentence pitch:** A single-player Omaha roguelite where the board is the dungeon and the four hole cards are the build.

**North-star feeling:** A Balatro player should say, “I can’t just paint a suit and high-card out — I have to live with this board.”

---

## 2. Goals

1. Ship a complete, replayable run on the web with no install and no account wall.
2. Make Omaha’s 2+3 rule the identity, not flavor text.
3. Keep runs short enough for a browser tab: first win ~12–20 minutes; strong run ~25–40 minutes.
4. Make scoring readable and theatrical (chips × mult, animated equation).
5. Stay free-to-play without pay-to-win, energy gates, or randomized power gacha.
6. Teach the 2+3 rule in one interactive screen so non-poker players can play.
7. Leave a content pipeline for relics, bosses, starting tables, and daily seeds after MVP.

---

## 3. Non-goals (explicit)

- Multiplayer, real-money poker, simulated betting against other players, or cash-out metaphors.
- A Balatro clone with a four-card private row and no Omaha constraint.
- Slay the Spire combat (HP, enemies, energy, block).
- 150 relics at launch.
- Native iOS/Android stores at MVP (PWA first).
- User-generated content, trading, or an open economy.
- Narrative campaign, voiced characters, or cinematic story.
- Physics-heavy or 3D presentation.

---

## 4. Target players

| Segment | Why they care | Risk |
|---|---|---|
| Balatro / roguelite fans | Builds, synergies, number-go-up | Will bounce if it feels like a reskin |
| Casual poker-aware players | Familiar hands, new puzzle | Will misread Omaha and feel cheated |
| Pure web / mobile idle-tab players | Instant load, short runs | Will bounce if UI is desktop-only |
| High-skill combo hunters | Rule-break relics | Will demand deterministic seeds and a collection |

**Literacy assumption:** Player does **not** need to know Omaha. The game must compute and display legal combos.

---

## 5. Core rules

### 5.1 Cards

- Standard 52-card deck unless a starting table says otherwise.
- Ranks A, K, Q, J, 10–2. Ace high; Ace-low straights allowed unless a modifier forbids them.
- Four suits.

### 5.2 Omaha construction (invariant)

A legal scored hand is **exactly 2 cards from the hole** and **exactly 3 cards from the board**.

- No “playing the board.”
- No using 1 or 3 hole cards unless a relic explicitly changes legal construction.
- Evaluator must enumerate `C(4,2) × C(5,3) = 60` candidate hands when the full board is out (fewer on flop/turn if streets are staged).

### 5.3 Deal model (MVP default)

Each **blind** (round):

1. Deal **4 hole cards**.
2. Deal a **5-card board**.
   - MVP may deal the full board at once for speed.
   - Post-MVP: flop (3) → turn (1) → river (1) with optional street powers between.
3. Player has a limited number of **plays** and **redraws**.
4. On a play, player commits a legal 2+3 combination.
5. Score is applied toward the blind target.
6. After a play, hole and/or board may refresh according to table + relic rules.

**Open design fork (must be decided before implementation):**

| Option | Hole persistence | Board persistence | Feel |
|---|---|---|---|
| A (recommended MVP) | New 4 hole cards each play | New 5-card board each play | Fast, web-friendly, more variance |
| B | Same 4 hole cards for the whole blind | Board rerolls or streets | More “PLO puzzle,” slower |
| C | Same hole for the ante | Board changes per blind | Build identity around one starting hand |

Scope assumes **Option A** unless design locks B/C. Relics can simulate B/C (“sticky ace”, “locked board card”).

### 5.4 Resources per blind

- **Plays** (default 3): each commits one scored hand.
- **Redraws** (default 2): replace selected hole and/or board cards per table rules.
- Relics, tables, and bosses may add/remove either.

Fail the target when plays hit 0. Succeed when cumulative score ≥ target.

---

## 6. Scoring

### 6.1 Formula

```
hand_score = (hand_base_chips + card_chips + relic_flat_chips)
             × (hand_base_mult + relic_plus_mult)
             × relic_mult_mult
             + delayed/trigger effects
```

Display as a left-to-right equation. The show is part of the product.

### 6.2 MVP hand table (tuning values, not final balance)

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

Royal flush is treated as a straight flush unless a later content pack splits it.

### 6.3 Omaha scoring concern

Omaha produces strong made hands more often than Hold’em/Balatro-style draw. If targets are copied from Balatro, Ante 1–3 will be trivial.

**Required work:** a dedicated blind-target curve for Omaha frequencies, not a copied Balatro curve.

### 6.4 Evaluation requirements

- Always show the **best legal hand** and allow manual override.
- Show the **six hole-pair tabs** so players learn Omaha by seeing options.
- Ties broken by standard poker kickers among the five scored cards only.
- Relics that change legality must run **before** enumeration.
- Relics that change score must run **after** hand classification, in a documented order.

**Scoring pipeline (mandatory, documented, testable):**

1. Apply legality modifiers.  
2. Enumerate legal 2+3 (or modified) combos.  
3. Classify hand type.  
4. Sum card chips.  
5. Apply on-card modifiers.  
6. Apply relic flat chips / +mult / ×mult in slot order.  
7. Apply “if unused hole cards…” and similar after-score triggers.  
8. Write a replay log of every step.

Without a stable pipeline, synergy bugs will be undebuggable.

---

## 7. Run structure

### 7.1 Layout

- **Ante** 1–8 to win the run.
- Each ante: **Small Blind → Big Blind → Boss Blind**.
- After each won blind: **shop**.
- After Boss: ante increases; targets scale; new boss modifier is previewed at ante start.
- Optional **Endless** after Ante 8 (score chase, no new meta unlock requirement).

### 7.2 Session targets

| Milestone | Time |
|---|---|
| Tutorial + first Small Blind | < 3 min |
| First full ante | ~4–6 min |
| First win (Ante 8) | 12–20 min for a competent first-time winner after a few losses |
| Strong optimized run | 25–40 min |

If a run regularly exceeds 45 minutes before Ante 8, the loop is too heavy for web.

### 7.3 Money

Earned from:

- Beating a blind (base payout).
- Overkill score (capped).
- Unused plays / redraws (table-dependent).
- Interest above a cash threshold.
- Relic triggers.

Spent in the shop on relics, consumables, packs, and rerolls.

### 7.4 Shop (keep tiny for mobile)

- 3 item slots (relics and/or consumables).
- 1 pack slot.
- 1 reroll button (cost scales per shop).
- Sell relics to free slots (default cap: **5 relic slots**).

No infinite shop inventory.

---

## 8. Content systems

### 8.1 Relics (“Jokers”)

Persistent run modifiers. Five slots. Primary build identity.

Relics should attack **hole selection, board state, or the 2+3 rule**. Generic “+mult on hearts” is allowed only as glue, not as the whole set.

**MVP relic count: 15**, all interacting with Omaha structure. Examples of legal design space:

- Use 3 hole + 2 board.
- Use 1 hole + 4 board (rare).
- Score best and second-best legal combo on one play.
- Unused hole cards still add chips if they pair the board.
- If the two committed hole cards are suited, +mult.
- Lock one board card into the next play.
- Copy a board card.
- River always scores ×2.
- Sticky ace: one hole card persists.

**Post-MVP cap target:** 60–80 before considering a Balatro-scale 150. Quality and legality interaction > count.

### 8.2 Consumables

- **Streets:** one-shot board manipulators (replay flop, force pair on board, burn river).
- **Hand levelers** (planet-equivalent): permanently raise base chips/mult of one hand type for the run.
- **Card mods:** foil / steel / stone / holographic — preferably on **ranks or board seats**, not only random deck cards. Board-seat mods are a unique hook.

### 8.3 Packs

Small draft packs of 3–5 options, pick 1 (or 2 with a voucher). Types:

- Relic pack
- Street pack
- Hand-level pack
- Mod pack

### 8.4 Starting tables (decks)

Unlockable via play, not cash.

MVP:

1. **Classic** — 52 cards, 3 plays, 2 redraws.  
2. **Double-suited** — more suited hole frequency, fewer redraws.  
3. **Short deck** — 36 cards (6+), hotter hands, higher targets.  
4. **Naked board** — streets revealed one at a time, extra cash.

Post-MVP: Five-card Omaha (5 hole, use 2), wild-board, lowball, etc.

### 8.5 Boss blinds

Each boss applies **one readable rule twist**, previewed at ante start.

MVP set (8):

1. Must commit two hole cards of the same suit.  
2. Board has only 4 cards.  
3. No flushes score.  
4. Hole cards face-down until commit (commit is blind; evaluator still checks legality).  
5. One suit on the board is dead.  
6. Only the first street exists (3-card board; legality becomes 2+3 impossible unless relics rewrite — **design carefully or replace**).  
7. Plays cost an extra redraw or start with 1 redraw.  
8. Score only the second-best legal combo.

**Concern:** some boss ideas break 2+3 entirely. Every boss must still produce legal plays for a default table with no relics, or the run is a brick.

### 8.6 Vouchers / ante upgrades (post-MVP acceptable)

Permanent-in-run passives: +1 play, +1 relic slot, interest rate, pack size. Keep out of MVP if shop is already crowded.

---

## 9. Meta progression

Unlocked across runs, never required to take the first win (first win must be possible on Classic with tutorial relics only).

- Collection of seen relics / bosses / tables.
- Starting-table unlocks.
- Cosmetic unlocks.
- Challenge seeds.
- Optional stake-like difficulty modifiers after first win.

**Concern:** meta that gates basic relics behind dozens of hours will feel like a live-service treadmill. Prefer discovery in-run + collection complete-by-playing.

---

## 10. Tutorial and onboarding

### 10.1 One-screen Omaha lesson (mandatory)

Example:

- Board: `A♠ K♠ 9♥ 4♣ 2♦`
- Hole: `A♥ A♦ 7♠ 6♠`

Teach:

1. Pair of aces is not automatic.  
2. You pick **which two** hole cards.  
3. Tabs show the six pairings.  
4. The game will highlight the current best legal 2+3.

If this screen fails, the whole game fails for non-PLO players.

### 10.2 Second screen

Chips × mult, plays vs target, shop after the blind.

### 10.3 What not to do

- Do not dump a poker-hand ranking wall of text.
- Do not assume Texas Hold’em “use any cards” instincts.
- Do not hide the auto-evaluator behind a hard mode at MVP.

---

## 11. UX / UI concerns

### 11.1 Layout

Two visual groups at all times:

- **HOLE (4)** with the committed 2 highlighted.
- **BOARD (5)** with the committed 3 highlighted.

Unused cards dim. Relics that care about unused cards must ping those cards.

### 11.2 Input

**Desktop:** click to toggle inclusion; commit button enabled only on a legal 2+3 (or current legal shape).

**Mobile (first-class, not a port):**

- One-handed portrait is a design requirement.
- Large hit targets.
- Drag two hole cards to a commit zone **or** tap-toggle with a persistent counter: `Hole 2/2 · Board 3/3`.
- No hover-only information. Every tooltip needs a tap panel.
- Shop must work on a 390×844 viewport without horizontal scroll.

### 11.3 Information density

Balatro-like UIs rot on phones. Budget:

- Target score, current score, plays, redraws, cash: always visible.
- Relic row: icons; tap for full text.
- Hand tabs: 6 hole pairs, swipeable on mobile.

### 11.4 Juice (in scope)

- Snap cards into HOLE/BOARD rows.
- Count-up chips, punch mult, slam total.
- Named boss title + one-line rule.
- Cheap consistent art direction (felt + neon is enough).
- Reduced-motion option (accessibility + vestibular).

### 11.5 Accessibility

- Color not the only suit signal (pip + letter + shape).
- Screen-reader labels for card ranks/suits and “legal combo.”
- Keyboard navigation on desktop.
- Contrast on felt backgrounds.
- Full text for relics, not icon-only rules.

### 11.6 Language / teaching copy

Every relic must be one sentence plus one example. Ambiguous relic text is a defect.

---

## 12. Monetization and F2P constraints

### 12.1 Allowed

- Game is fully playable free, including winning Ante 8.
- Optional account for cloud save and leaderboards.
- Cosmetics: felts, card backs, scoring stamp styles, relic skins.
- Battle pass that is **cosmetic-first**; any starting table in a pass must also be earnable by play.
- Supporter tier: extra cosmetics, optional ad-free if ads ever exist on menus only.

### 12.2 Forbidden

- Pay for plays, redraws, relic slots, or stronger relics.
- Energy / stamina to start a run.
- Loot boxes whose contents affect run power.
- Real-money wagering, chip cash-out, or “next hand costs $.”
- Ads mid-blind or mid-shop decision.
- Dark-pattern daily login that bricks progress.

### 12.3 Platform / policy concern

Even fictional chips + poker hands can trigger **ad-network and store gambling flags** later. Scope the presentation:

- Score is **chips for blinds**, not a cash-out wallet.
- Avoid cashier cages, withdrawal UI, or “buy chips.”
- If ads are ever added, keep them out of the core loop and review regional gambling-ad rules.

### 12.4 Revenue is post-product

Do not design the economy around monetization in MVP. A dead game with a shop is still a dead game.

---

## 13. Technical scope

### 13.1 Recommended stack

- **TypeScript**
- **React or Svelte** for UI and game state
- **Vite**
- **PWA** (offline cache of shell + last run)
- Hosting: Cloudflare Pages or equivalent static host
- Optional thin API later for accounts, seeds, and leaderboard validation

Do **not** start in Unity/Godot for a 2D card state machine.  
Do **not** put card layout in Phaser unless scoring VFX clearly needs a renderer. Phaser/Pixi is an optional juice layer, not the rules engine.

### 13.2 Architecture

Client-authoritative for feel. If leaderboards exist, the server replays a **seed + action log**.

Core modules:

- `Deck`
- `Hole`
- `Board`
- `HandEvaluator` (Omaha 2+3 + modifier hooks)
- `ScoringPipeline`
- `Blind` (target, plays, redraws, modifiers)
- `Relic` interface: `alterLegalCombos`, `onStreet`, `onScore`, `onShop`, `onBlindStart`
- `Shop`
- `Run`
- `Rng` (seeded)
- `ReplayLog`

### 13.3 Determinism

- Seeded PRNG for daily runs and debugging.
- Same seed + same actions = same cards and shop.
- Never call `Math.random()` in rules code.

### 13.4 Persistence

- `localStorage` / IndexedDB for run state, settings, collection, guest profile.
- Refresh must not destroy an in-progress blind.
- Cloud save only after auth exists.

### 13.5 Performance budget

- First interactive paint: target < 2s on mid-range mobile.
- No multi-megabyte art atlas at MVP.
- Evaluator of 60 hands is trivial; do not over-optimize it. Optimize render/layout instead.
- 60fps on scoring animation; rules can be instant.

### 13.6 Testing (non-optional)

- Golden tests for hand classification (especially wrap straights, wheel A-2-3-4-5, flush+pair full house, board-paired quads with 2 hole kickers).
- Golden tests for “must use two hole cards” traps (board flush is not a flush unless two hole cards suit it).
- Relic interaction fixtures.
- Boss “always has a legal play on Classic” fixtures.

Omaha evaluation bugs will be reported as “the game cheated me.” They are launch blockers.

---

## 14. Legal, ethical, and IP concerns

### 14.1 Inspiration vs clone

Balatro’s loop is a genre pattern (blinds, shop, relics, chips × mult). Do **not** copy:

- Balatro joker names, art, exact relic text, or UI layout.
- Balatro’s specific planet/tarot/spectral set.
- Trademarked names or distinctive character (“Jimbo”).

Omaha/poker hand ranks and a 52-card deck are public domain rules, not Balatro’s.

### 14.2 Gambling ethics

This is a **single-player score game**. Still:

- No real-money stakes.
- No “simulated addiction cashier.”
- Near-miss juice is fine; paid rerolls of power is not.
- If the team ever adds social leaderboards with prizes, re-evaluate gambling law.

### 14.3 Cards and assets

- Use original card face art or clearly licensed assets.
- Standard rank/suit symbols are fine; distinctive published card-back designs are not.

### 14.4 Names and trademarks

Clear the working title before marketing. Avoid existing poker-client names and Balatro-adjacent trademarks.

### 14.5 Data / privacy

- Guest play with no account.
- If accounts exist: minimal data, age-gate if required by region, export/delete.
- No selling play data.

---

## 15. Balance and systems concerns

1. **Strong-hand inflation.** Omaha makes flushes/full houses common. Targets and base tables must assume that.  
2. **Analysis paralysis.** Six pair tabs + 60 combos + 5 relics can freeze mobile players. Auto-best + one-tap commit is required; mastery is optional override.  
3. **Brick bosses.** A boss that forbids the only hand the player built toward must be previewed and survivable by pivoting, not by lucking a new relic the same shop.  
4. **Shop starvation.** If money is too tight, runs feel identical. If too loose, Ante 8 is free. Track median cash at each ante.  
5. **Relic cap.** Five slots force builds. Selling must feel fair.  
6. **Redraw design.** If redraws can rewrite hole and board freely, Omaha identity dies. Define redraw scope per table.  
7. **Option A variance.** Full redeal each play is swingy. Mitigate with relics that lock cards, not by adding Slay the Spire length.  
8. **First-win rate.** Target ~15–30% win rate on Classic after the player understands 2+3, before meta unlocks. Much higher and there is no roguelite; much lower and web players churn.  
9. **Endless overflow.** Use bigints or capped display (`1.2e12`) before scores explode.  
10. **Seeded daily fairness.** No unseeded shop timing exploits; define when RNG is drawn.

---

## 16. Live-ops and community (post-MVP, designed now)

- Daily seeded run, same seed worldwide.
- Weekly named boss challenge.
- Collection / bestiary.
- Optional global leaderboard with server replay.

**Concern:** client-only leaderboards will be hacked immediately. Either skip them at MVP or validate replays.

---

## 17. Phased delivery

### Phase 0 — Spike (3–5 days)

- Evaluator + 60-combo listing.
- One screen: deal 4+5, tap a legal hand, print classification.
- Prove the teaching tabs.

### Phase 1 — MVP (target 6 weeks)

**Week 1–2:** deal, legal highlighter, chips × mult, one ante of three blinds, no shop.  
**Week 3:** shop, 15 relics, 8 hand-level items, money.  
**Week 4:** 8 bosses, 4 tables, win/lose, collection.  
**Week 5:** juice, portrait layout, daily seed (client-only is acceptable).  
**Week 6:** balance, tutorial, bug bash on Omaha traps.

**MVP done means:**

- Guest can start a run in one click.
- Tutorial teaches 2+3.
- Full Ante 1–8 exists.
- At least one non-trivial winning build exists that is not “hit quads.”
- Refresh-safe run save.
- Playable on a phone-sized viewport.

### Phase 2

- Street-by-street boards.
- More relics (to ~40).
- Vouchers.
- Auth + cloud save.
- Validated daily leaderboard.
- Cosmetics store.
- Reduced-motion / a11y pass completed.

### Phase 3

- Endless balance.
- Challenges / stakes.
- Extra tables (5-card Omaha).
- Optional Pixi/Phaser scoring cinema.
- Localization.

---

## 18. Team assumptions

This scope is sized for a **very small team** (1 designer-engineer + optional artist) or a solo developer.

Art can be geometric/vector at MVP. Relic text and evaluator correctness outrank illustration.

---

## 19. Success metrics

| Metric | MVP target |
|---|---|
| Tutorial completion | ≥ 80% of first sessions |
| Second-run rate | ≥ 40% |
| Time to first Ante 2 | < 10 min median |
| Classic win rate (post-tutorial players, 10+ runs) | 15–30% |
| Mobile session share | Track; layout must not be the bounce reason |
| Evaluator dispute reports | ~0 after week 6 patch |
| Store/policy rejection risk | No real-money or mid-run ads |

---

## 20. Open questions (must close before hard implementation)

1. Hole/board persistence model: A, B, or C?  
2. Full board vs streets in MVP?  
3. Do redraws replace hole, board, or player-chosen cards?  
4. Does a play consume the committed cards only, or redeal everything?  
5. Ace-low straights on/off by default?  
6. Is high card allowed as a scored play (yes, recommended)?  
7. Boss set: drop any modifier that can produce zero legal hands.  
8. Title and art direction lock.  
9. Accounts at MVP or later?  
10. Leaderboards at MVP or later?  
11. Option to hide auto-best hand (hard mode) — later, not MVP.  
12. Interest rules and skip-small-blind-for-cash?

---

## 21. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Read as a Balatro clone | High | Omaha 2+3 is always visible; unique board relics; original names/art |
| Players apply Hold’em rules and rage-quit | High | Auto-eval, six pair tabs, tutorial example |
| Targets tuned like Balatro, game is trivial | High | Frequency sim before locking curve |
| Mobile UI unreadable | High | Portrait-first shop and relic text |
| Relic interactions break legality | High | Pipeline + golden tests + replay log |
| Gambling-policy flags | Medium | No cashier, no paid power, careful wording |
| Scope creep to 150 relics / streets / narrative | High | 15 relics, 8 bosses, 4 tables at MVP |
| Run too long for web | Medium | Redeal model, skippable small blinds, 8 antes only |
| Leaderboard cheating | Medium | No board at MVP, or seed+replay validation |
| First-win gated by meta grind | Medium | Classic is complete |
| Accessibility / colorblind suits | Medium | Pips + letters, not hue alone |
| Save loss on refresh | Medium | Persist after every action |
| Numeric overflow in endless | Low | Bigint / scientific display |
| Solo-dev burnout on juice | Medium | Geometric art, equation juice first |

---

## 22. Out of scope until explicitly added

- Multiplayer PLO vs AI table.
- Real-time streaming of other players’ boards.
- NFT / wallet / crypto.
- User-made relics.
- Seasonal power creep that invalidates old relics.
- Native store apps.
- Controller-only UI.
- Localization beyond source language.

---

## 23. Implementation checklist (MVP acceptance)

- [ ] Seeded RNG only in rules code  
- [ ] Omaha evaluator golden tests passing  
- [ ] Best-hand highlighter + six hole-pair tabs  
- [ ] Chips × mult animation with reduced-motion fallback  
- [ ] 3 blinds × 8 antes + shop  
- [ ] 15 relics, 8 bosses, 4 tables  
- [ ] Tutorial example hand  
- [ ] Guest save/resume  
- [ ] Portrait shop + commit UI  
- [ ] No paid power  
- [ ] Replay log download for a failed blind (debug)  
- [ ] First-win possible on Classic  

---

## 24. Document history

- v0.1 — Initial scope from design brief: Omaha 2+3 + Balatro-like run loop + F2P web constraints, including product, UX, tech, legal, balance, and phased delivery.