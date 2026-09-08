# Super Omaha

> **Working title — TBD.** Candidates: _Omaha Ante_, _Four-Hole_, _The Flop
> Pit_, _Double Hole_, _Pot of Fools_.

A single-player **Omaha-inspired poker roguelite** for the browser. Beat
escalating score blinds by building hands with **exactly 2 hole cards + exactly
3 board cards** — then buy relics that cheat that rule.

**Pitch:** the board is the dungeon, and the four hole cards are the build.

---

## Status

🚧 **Phase 0 (spike) underway.** The Omaha 2+3 evaluator and its golden tests
are implemented in [core/](core), with a playable deal-and-commit spike island.
Run structure, shop, and relics are not started — see
[docs/roadmap.md](docs/roadmap.md).

## Documentation

| Doc                                | Contents                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| [docs/scope.md](docs/scope.md)     | **Source of truth** — product, design, engineering, legal, and balance scope            |
| [docs/spec.md](docs/spec.md)       | Functional specification — testable requirements for gameplay, scoring, UX, and content |
| [docs/design.md](docs/design.md)   | Architecture — stack, core modules, determinism, persistence, testing strategy          |
| [docs/roadmap.md](docs/roadmap.md) | Phased delivery plan — Phase 0 spike → 6-week MVP → post-MVP depth                      |

## Stack

- **Deno 2** + **Fresh 2** (Preact islands) + **Vite** — the DONUT stack
- **PWA** (offline shell + run resume)
- Pure rules core in [core/](core) (`cards`, seeded `Rng`, Omaha
  `HandEvaluator`); zero DOM, zero `Math.random()`

## Develop

```bash
deno task dev      # dev server with watch
deno task test     # full test suite (core rules + replay validator)
deno task check    # fmt + lint + type-check
deno task build    # production build
deno task start    # serve production build
deno task db:init  # apply db/schema.sql to $DATABASE_URL
```

Optional server features (accounts, cloud save, validated daily leaderboard)
need PostgreSQL — set `DATABASE_URL` (defaults to
`postgres://nashtwin:nashtwin@localhost:5432/super_omaha`) and run
`deno task db:init`. Without a database the game is fully playable as a guest.

## Deployment

Self-hosted on the **DONUT stack** (Deno · Oak · Nginx · Ubuntu · TypeScript)
using the vendored [DONUT Deploy](deploy/README.md) scripts.

- [main.ts](main.ts) is the Fresh server entrypoint; DONUT Deploy runs
  `deno task build` automatically for Fresh projects, then `deno task start`
  serves the built app (`_fresh/server.js`) behind nginx.
- [deploy/](deploy) installs a systemd unit + nginx reverse proxy (with optional
  Let's Encrypt TLS).

Typical install on the server:

```bash
sudo ./deploy/install.sh \
  --name super-omaha \
  --dir /srv/super-omaha \
  --domain omaha.example.com \
  --command "/home/sam/.deno/bin/deno task start"
```

Use `--dry-run` to preview the rendered systemd/nginx files, `--http-only`
before TLS certificates exist, and `--skip-nginx` if another proxy owns ingress.

## Key constraints

- Free-to-play, **no pay-to-win** — no paid plays, redraws, relic slots, or
  power gacha
- Mobile-first portrait UI (usable at 390×844)
- Deterministic seeded RNG — same seed + same actions = same run
- No real-money wagering, no cashier UI, nothing that reads as gambling

## Getting started

Clone, then `deno task dev`. The full game is playable: tutorial at
[/tutorial](routes/tutorial.tsx), 4 tables, 25 relics, 8 bosses, shops,
vouchers, endless mode, daily seeds, and save/resume. Optional:
`deno task
db:init` + `DATABASE_URL` for accounts, cloud save, and the validated
daily leaderboard at [/account](routes/account.tsx).
