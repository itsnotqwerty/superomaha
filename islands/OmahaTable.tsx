// MVP game island: full run loop — blinds, shop, relics, bosses, save/resume.
// All rules live in core/; this component renders state and dispatches
// semantic actions (design §4: no rules logic in components).
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  Card,
  cardAria,
  cardId,
  cardLabel,
  Suit,
  suitLetter,
} from "../core/cards.ts";
import {
  bestByHolePair,
  EvaluatedHand,
  HAND_TABLE,
} from "../core/evaluator.ts";
import { Modifier } from "../core/mods.ts";
import {
  collectionKey,
  loadCollection,
  recordRun,
} from "../core/collection.ts";
import { parseSnapshot, saveKey, serializeSnapshot } from "../core/persist.ts";
import {
  CARD_BACKS,
  classFor,
  CosmeticChoice,
  cosmeticsKey,
  FELTS,
  loadCosmetics,
} from "../core/cosmetics.ts";
import { RELIC_REGISTRY } from "../core/relics.ts";
import { ScoreResult } from "../core/scoring.ts";
import { ShopItem } from "../core/shop.ts";
import { TABLE_REGISTRY, TABLES } from "../core/tables.ts";
import { challengeSeed, STAKE_REGISTRY, STAKES } from "../core/stakes.ts";
import { formatScore } from "../core/numfmt.ts";
import { Run } from "../core/run.ts";

const SUIT_CLASS: Record<Suit, string> = {
  spades: "suit-s",
  hearts: "suit-h",
  diamonds: "suit-d",
  clubs: "suit-c",
};

function handKey(h: EvaluatedHand): string {
  return `${h.holeIdx.join(".")}-${h.boardIdx.join(".")}`;
}

function holePairLabel(h: EvaluatedHand): string {
  return h.cards.slice(0, h.holeIdx.length).map(cardLabel).join(" ");
}

function CardView(
  { card, committed, marked, dimmed, hidden, onClick }: {
    card: Card;
    committed: boolean;
    marked: boolean;
    dimmed: boolean;
    hidden?: boolean;
    onClick?: () => void;
  },
) {
  return (
    <button
      type="button"
      class={`card ${SUIT_CLASS[card.suit]}${committed ? " committed" : ""}${
        marked ? " marked" : ""
      }${dimmed ? " dimmed" : ""}${hidden ? " hidden-card" : ""}`}
      onClick={onClick}
      aria-label={hidden
        ? "face-down card"
        : `${cardAria(card)}${marked ? ", marked for redraw" : ""}${
          committed ? ", in committed hand" : ""
        }`}
      aria-pressed={marked}
    >
      {hidden ? "🂠" : (
        <>
          {cardLabel(card)}
          <span class="suit-letter" aria-hidden="true">
            {suitLetter(card.suit)}
          </span>
        </>
      )}
    </button>
  );
}

/** Score theater: animated chips × mult equation from the pipeline step list.
 * Reduced-motion (or a tap) shows the final values instantly. */
function ScoreTheater(
  { result, onDone }: { result: ScoreResult; onDone: () => void },
) {
  const reduced = typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(reduced ? result.steps.length : 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduced || shown >= result.steps.length) return;
    timer.current = setTimeout(() => setShown((s) => s + 1), 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [shown, reduced, result.steps.length]);

  const finished = shown >= result.steps.length;
  const last = result.steps[Math.min(shown, result.steps.length) - 1] ??
    result.steps[0];

  return (
    <button
      type="button"
      class="theater"
      onClick={() => (finished ? onDone() : setShown(result.steps.length))}
      aria-live="polite"
    >
      <div class="theater-steps">
        {result.steps.slice(0, shown).map((s, i) => (
          <div key={i} class="theater-step">{s.label}</div>
        ))}
      </div>
      {shown > 0 && (
        <div class="theater-eq">
          <span class="theater-chips">{last.chips}</span>
          <span class="theater-x">×</span>
          <span class="theater-mult">{last.mult}</span>
          <span class="theater-eq-sign">=</span>
          <span class="theater-total">
            {finished ? result.total : last.total}
          </span>
        </div>
      )}
      <div class="theater-hint">
        {finished ? "tap to continue" : "tap to skip"}
      </div>
    </button>
  );
}

export default function OmahaTable() {
  // SSR-safe: create the run client-side only (islands are server-rendered).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [runSeed, setRunSeed] = useState<string | null>(null);
  const [tableId, setTableId] = useState(TABLES[0].id);
  const [stakeId, setStakeId] = useState("base");
  const [challengeTag, setChallengeTag] = useState("");
  const [hasSave, setHasSave] = useState(false);
  const [cosmetics, setCosmetics] = useState<CosmeticChoice>({
    felt: "felt-classic",
    cardBack: "back-classic",
  });
  const [collection, setCollection] = useState(() => ({
    relics: [] as string[],
    bosses: [] as string[],
    tables: [] as string[],
    wins: 0,
    runs: 0,
    bestAnte: 0,
  }));

  useEffect(() => {
    if (!mounted) return;
    setHasSave(!!parseSnapshot(localStorage.getItem(saveKey())));
    setCosmetics(loadCosmetics(localStorage.getItem(cosmeticsKey())));
    setCollection(loadCollection(localStorage.getItem(collectionKey())));
  }, [mounted]);

  const tableClass = `table ${classFor(FELTS, cosmetics.felt)} ${
    classFor(CARD_BACKS, cosmetics.cardBack)
  }`;

  const run = useMemo(() => {
    if (!mounted || !runSeed) return null;
    if (runSeed === "__resume__") {
      const snap = parseSnapshot(localStorage.getItem(saveKey()));
      if (snap) {
        const table = TABLE_REGISTRY.get(snap.tableId) ?? TABLES[0];
        return Run.restore(snap, table);
      }
    }
    const table = TABLE_REGISTRY.get(tableId) ?? TABLES[0];
    const stake = STAKE_REGISTRY.get(stakeId) ?? STAKES[0];
    return new Run(runSeed, table, stake);
  }, [mounted, runSeed, tableId, stakeId]);

  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [markedHole, setMarkedHole] = useState<number[]>([]);
  const [markedBoard, setMarkedBoard] = useState<number[]>([]);
  const [theater, setTheater] = useState<ScoreResult | null>(null);
  const [expandedRelic, setExpandedRelic] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Derived game state (hooks must run before any early return) ----
  const blind = run?.blind ?? null;
  const bs = blind?.state ?? null;
  const relics = run?.relics ?? [];
  const boss = blind?.boss ?? null;
  const hideHole = !!boss?.hideHole;
  const playing = !!bs && bs.phase === "playing";

  const all: EvaluatedHand[] = useMemo(
    () => (blind && playing ? blind.legalHands(relics) : []),
    [blind?.state.hole, blind?.state.board, bs?.phase, version],
  );
  const forced: EvaluatedHand | undefined = useMemo(
    () => (blind && playing ? blind.defaultPick(relics) : undefined),
    [blind?.state.hole, blind?.state.board, bs?.phase, version],
  );
  const locked = !!blind && blind.legality(relics).forcePick !== undefined;
  const best = all[0];

  const byPair: Map<string, EvaluatedHand> = useMemo(
    () =>
      blind && playing && !hideHole && bs
        ? bestByHolePair(bs.hole, bs.board, blind.legality(relics))
        : new Map<string, EvaluatedHand>(),
    [blind?.state.hole, blind?.state.board, bs?.phase, version],
  );

  const selected: EvaluatedHand | undefined = useMemo(() => {
    if (locked) return forced;
    if (selectedKey) {
      const found = all.find((h) => handKey(h) === selectedKey);
      if (found) return found;
    }
    return best;
  }, [selectedKey, all, best, forced, locked]);

  // Save after every action (REQ-SAVE-1).
  function persist(r: Run) {
    try {
      localStorage.setItem(saveKey(), serializeSnapshot(r.snapshot()));
    } catch {
      /* storage full or unavailable — play continues */
    }
  }

  function act(fn: () => void) {
    fn();
    if (run) persist(run);
    bump();
  }

  if (!mounted) return <div class="table">Shuffling…</div>;

  if (!run) {
    const today = new Date().toISOString().slice(0, 10);
    return (
      <div class={`${tableClass} title-screen`}>
        <h2>Start a run</h2>
        <label class="field">
          Table
          <select
            value={tableId}
            onChange={(e) => setTableId((e.target as HTMLSelectElement).value)}
          >
            {TABLES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <p class="table-desc">
          {(TABLE_REGISTRY.get(tableId) ?? TABLES[0]).text}
        </p>
        <label class="field">
          Stake
          <select
            value={stakeId}
            onChange={(e) => setStakeId((e.target as HTMLSelectElement).value)}
          >
            {STAKES.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.unlock(collection)}>
                {s.name}
                {s.unlock(collection) ? "" : " 🔒 win a run"}
              </option>
            ))}
          </select>
        </label>
        <p class="table-desc">
          {(STAKE_REGISTRY.get(stakeId) ?? STAKES[0]).text}
        </p>
        <label class="field">
          Felt
          <select
            value={cosmetics.felt}
            onChange={(e) => {
              const next = {
                ...cosmetics,
                felt: (e.target as HTMLSelectElement).value,
              };
              setCosmetics(next);
              localStorage.setItem(cosmeticsKey(), JSON.stringify(next));
            }}
          >
            {FELTS.map((f) => (
              <option
                key={f.id}
                value={f.id}
                disabled={!f.unlock(collection)}
              >
                {f.name}
                {f.unlock(collection) ? "" : ` 🔒 ${f.unlockText}`}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          Card back
          <select
            value={cosmetics.cardBack}
            onChange={(e) => {
              const next = {
                ...cosmetics,
                cardBack: (e.target as HTMLSelectElement).value,
              };
              setCosmetics(next);
              localStorage.setItem(cosmeticsKey(), JSON.stringify(next));
            }}
          >
            {CARD_BACKS.map((b) => (
              <option
                key={b.id}
                value={b.id}
                disabled={!b.unlock(collection)}
              >
                {b.name}
                {b.unlock(collection) ? "" : ` 🔒 ${b.unlockText}`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          class="commit"
          onClick={() => setRunSeed(`run-${Date.now()}`)}
        >
          New run
        </button>
        <button
          type="button"
          class="redraw"
          onClick={() => setRunSeed(`daily-${today}`)}
        >
          Daily seed ({today})
        </button>
        <div class="challenge-row">
          <input
            class="challenge-input"
            placeholder="Challenge tag (e.g. rival42)"
            value={challengeTag}
            onInput={(e) =>
              setChallengeTag((e.target as HTMLInputElement).value)}
          />
          <button
            type="button"
            class="redraw"
            disabled={!challengeTag.trim()}
            onClick={() =>
              setRunSeed(challengeSeed(stakeId, tableId, challengeTag.trim()))}
          >
            Challenge seed
          </button>
        </div>
        {hasSave && (
          <button
            type="button"
            class="redraw"
            onClick={() => setRunSeed("__resume__")}
          >
            Continue saved run
          </button>
        )}
        <a class="tutorial-link" href="/tutorial">How to play (Omaha 2+3)</a>
        <a class="tutorial-link" href="/collection">Collection</a>
        <a class="tutorial-link" href="/account">Account & daily leaderboard</a>
      </div>
    );
  }

  const rs = run.state;
  void version;

  // Non-null after the early returns above.
  const b = bs!;
  const bl = blind!;

  const kindLabel = `${run.kind} blind`;

  function clearMarks() {
    setMarkedHole([]);
    setMarkedBoard([]);
  }

  function toggleMark(zone: "hole" | "board", i: number) {
    const [list, setList] = zone === "hole"
      ? [markedHole, setMarkedHole]
      : [markedBoard, setMarkedBoard];
    setList(list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);
  }

  function redraw() {
    act(() => {
      if (run!.commitRedraw(markedHole, markedBoard)) {
        clearMarks();
        setSelectedKey(null);
      }
    });
  }

  function commit() {
    if (!selected) return;
    act(() => {
      if (run!.commitPlay(selected.holeIdx, selected.boardIdx)) {
        const result = bl.state.history.at(-1) ?? null;
        if (result) setTheater(result);
      }
    });
    clearMarks();
    setSelectedKey(null);
  }

  function closeTheater() {
    act(() => {
      setTheater(null);
      if (bl.state.phase !== "playing") run!.settle();
    });
  }

  function leaveShop() {
    act(() => run!.leaveShop());
    clearMarks();
    setSelectedKey(null);
  }

  function newRun() {
    // Record this run's seen content into the cross-run collection.
    if (run) {
      const c = loadCollection(localStorage.getItem(collectionKey()));
      const seen = run.seen;
      const next = recordRun(c, {
        ...seen,
        ante: run.state.ante,
        won: run.state.phase === "won",
      });
      try {
        localStorage.setItem(collectionKey(), JSON.stringify(next));
      } catch { /* ignore */ }
    }
    localStorage.removeItem(saveKey());
    setRunSeed(null);
    setTheater(null);
    setHasSave(false);
    bump();
  }

  // ---- Render ----

  if (rs.phase === "won" && !rs.endless) {
    return (
      <div class="table end-screen">
        <h2>🏆 Run complete!</h2>
        <p>You beat Ante 8 on {run.table.name}. Cash banked: ${rs.cash}.</p>
        <LeaderboardSubmit run={run} />
        <button
          type="button"
          class="commit"
          onClick={() => act(() => run!.continueEndless())}
        >
          Continue: Endless mode
        </button>
        <button type="button" class="redraw" onClick={newRun}>New run</button>
      </div>
    );
  }

  if (rs.phase === "lost") {
    return (
      <div class="table end-screen">
        <h2>💀 Run over</h2>
        <p>
          Fell short on Ante {rs.ante} {run.kind}{" "}
          blind ({run.table.name}). Cash: ${rs.cash}.
        </p>
        <LeaderboardSubmit run={run} />
        <ReplayDownload run={run} />
        <button type="button" class="commit" onClick={newRun}>New run</button>
      </div>
    );
  }

  return (
    <div class={tableClass}>
      <div class="hud">
        <span>
          {rs.endless ? `Endless · Ante ${rs.ante}` : `Ante ${rs.ante}/8`} ·
          {" "}
          {kindLabel} · {run.table.name}
        </span>
        <span class="hud-score">
          {formatScore(b.score)} / {formatScore(b.config.target)}
        </span>
        <span>
          plays {b.playsLeft} · redraws {b.redrawsLeft} · ${rs.cash}
        </span>
      </div>

      {boss && (
        <div class={`boss-banner${run.kind === "boss" ? " active" : ""}`}>
          <strong>{boss.name}</strong> — {boss.text}
          {run.kind !== "boss" && <em>(next: boss)</em>}
        </div>
      )}
      {!boss && run.kind !== "boss" && (
        <div class="boss-banner">
          Boss preview: <strong>{run.currentBoss.name}</strong> —{" "}
          {run.currentBoss.text}
        </div>
      )}

      <RelicRow
        relics={relics}
        expanded={expandedRelic}
        onTap={(i) => setExpandedRelic(expandedRelic === i ? null : i)}
      />

      {theater && <ScoreTheater result={theater} onDone={closeTheater} />}

      {rs.phase === "shop" && run.shop && (
        <div class="shop">
          <h3>Shop — ${rs.cash}</h3>
          <div class="shop-grid">
            {run.shop.state.items.map((item, i) => (
              <ShopCard
                key={i}
                item={item}
                cash={rs.cash}
                relicFull={rs.relicIds.length >= run.relicCap}
                onBuy={() =>
                  act(() => {
                    if (!run!.buyItem(i)) {
                      setError(
                        item?.kind === "relic" &&
                          rs.relicIds.length >= run.relicCap
                          ? "Relic slots full — sell one first."
                          : "Not enough cash.",
                      );
                      setTimeout(() => setError(null), 2500);
                    }
                  })}
              />
            ))}
          </div>

          {run.shop.state.voucher && (
            <button
              type="button"
              class="shop-card voucher-card"
              disabled={rs.cash < run.shop.state.voucher.price}
              onClick={() => act(() => run!.buyVoucher())}
            >
              <strong>🎟 {run.shop.state.voucher.name}</strong>
              <span class="shop-text">{run.shop.state.voucher.text}</span>
              <span class="price">${run.shop.state.voucher.price}</span>
            </button>
          )}

          {rs.relicIds.length > 0 && (
            <div class="sell-row">
              Sell: {rs.relicIds.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  class="relic-icon"
                  onClick={() => act(() => run!.sellRelic(i))}
                >
                  {RELIC_REGISTRY.get(id)?.name ?? id} +$3
                </button>
              ))}
            </div>
          )}

          {run.shop.state.pack && (
            <div class="pack">
              <div class="pack-head">
                {run.shop.state.pack.kind === "relic" ? "Relic" : "Hand-level"}
                {" "}
                pack — ${run.shop.state.pack.price} (pick 1)
              </div>
              <div class="pack-options">
                {run.shop.state.pack.options.map((opt) => {
                  const label = run.shop!.state.pack!.kind === "relic"
                    ? RELIC_REGISTRY.get(opt)!.name
                    : (opt as string).replaceAll("_", " ") + " +1";
                  return (
                    <button
                      key={opt}
                      type="button"
                      class="redraw"
                      disabled={rs.cash < run.shop!.state.pack!.price}
                      onClick={() => act(() => run!.buyPackOption(opt))}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {Object.keys(rs.handLevels).length > 0 && (
            <div class="levels">
              Levels:{" "}
              {Object.entries(rs.handLevels).map(([cat, l]) => (
                <span key={cat} class="level-chip">
                  {cat.replaceAll("_", " ")} +{l}
                </span>
              ))}
            </div>
          )}

          <div class="actions">
            <button
              type="button"
              class="redraw"
              disabled={rs.cash < run.shop.state.rerollCost}
              onClick={() => act(() => run!.rerollShop())}
            >
              Reroll (${run.shop.state.rerollCost})
            </button>
            <button type="button" class="commit" onClick={leaveShop}>
              Next: {nextLabel(run)}
            </button>
          </div>
          {error && <div class="error">{error}</div>}
        </div>
      )}

      {rs.phase === "playing" && !theater && (
        <>
          <div class="row-label">
            BOARD{boss?.boardSize ? ` (${boss.boardSize} cards)` : ""}
            {bl.state.config.streets &&
              ` — ${streetName(b.revealed)}`}
            {bl.deadSuit && ` — ${bl.deadSuit} dead`}
          </div>
          <div class="row" role="group" aria-label="board">
            {b.board.map((card, i) => {
              const revealed = i < b.revealed;
              return (
                <CardView
                  key={cardId(card) + i}
                  card={card}
                  hidden={!revealed}
                  committed={revealed &&
                    (selected?.boardIdx.includes(i) ?? false)}
                  marked={revealed && markedBoard.includes(i)}
                  dimmed={revealed && !!selected &&
                    !selected.boardIdx.includes(i)}
                  onClick={revealed ? () => toggleMark("board", i) : undefined}
                />
              );
            })}
          </div>

          <div class="row-label">HOLE{hideHole ? " (face-down)" : ""}</div>
          <div class="row" role="group" aria-label="hole">
            {b.hole.map((card, i) => (
              <CardView
                key={cardId(card) + i}
                card={card}
                hidden={hideHole}
                committed={selected?.holeIdx.includes(i) ?? false}
                marked={markedHole.includes(i)}
                dimmed={!!selected && !selected.holeIdx.includes(i)}
                onClick={() => toggleMark("hole", i)}
              />
            ))}
          </div>

          {!hideHole && (
            <nav class="pair-tabs" aria-label="hole pairings">
              {[...byPair.keys()].map((key) => {
                const h = byPair.get(key)!;
                const isBest = best && handKey(h) === handKey(best);
                const isSelected = selected && handKey(h) === handKey(selected);
                return (
                  <button
                    key={key}
                    type="button"
                    class={`pair-tab${isSelected ? " selected" : ""}${
                      isBest ? " best" : ""
                    }`}
                    disabled={locked && !isSelected}
                    onClick={() => setSelectedKey(handKey(h))}
                  >
                    {holePairLabel(h)}
                    <span class="pair-cat">
                      {h.category.replaceAll("_", " ")}
                      {isBest ? " ★" : ""}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          {selected && (
            <div class="score-line">
              <strong>{selected.category.replaceAll("_", " ")}</strong> —{" "}
              {HAND_TABLE[selected.category].chips} chips ×{" "}
              {HAND_TABLE[selected.category].mult} mult
              {locked && " (locked by boss)"}
            </div>
          )}

          <div class="actions">
            <button
              type="button"
              class="commit"
              onClick={commit}
              disabled={!selected}
            >
              Commit
            </button>
            <button
              type="button"
              class="redraw"
              onClick={redraw}
              disabled={markedHole.length + markedBoard.length === 0 ||
                b.redrawsLeft === 0}
            >
              Redraw {markedHole.length + markedBoard.length > 0
                ? `${markedHole.length + markedBoard.length}`
                : "(tap cards)"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function nextLabel(run: Run): string {
  if (run.kind === "boss") return `Ante ${run.state.ante + 1}`;
  return run.kind === "small" ? "Big blind" : "Boss blind";
}

function streetName(revealed: number): string {
  return revealed <= 3 ? "flop" : revealed === 4 ? "turn" : "river";
}

function RelicRow(
  { relics, expanded, onTap }: {
    relics: Modifier[];
    expanded: number | null;
    onTap: (i: number) => void;
  },
) {
  if (relics.length === 0) return null;
  return (
    <div class="relic-row" aria-label="relics">
      {relics.map((r, i) => (
        <div key={r.id} class="relic">
          <button type="button" class="relic-icon" onClick={() => onTap(i)}>
            {r.name}
          </button>
          {expanded === i && (
            <div class="relic-text">
              <strong>{r.name}</strong> — {r.text}
              <em>Example: {r.example}</em>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ShopCard(
  { item, cash, relicFull, onBuy }: {
    item: ShopItem | null;
    cash: number;
    relicFull: boolean;
    onBuy: () => void;
  },
) {
  if (!item) {
    return <div class="shop-card sold">Sold out</div>;
  }
  const disabled = cash < item.price || (item.kind === "relic" && relicFull);
  return (
    <button
      type="button"
      class="shop-card"
      disabled={disabled}
      onClick={onBuy}
    >
      {item.kind === "relic"
        ? (
          <>
            <strong>{item.relic.name}</strong>
            <span class="shop-text">{item.relic.text}</span>
          </>
        )
        : (
          <>
            <strong>{item.category.replaceAll("_", " ")} +1</strong>
            <span class="shop-text">
              Permanent +10 chips, +1 mult this run.
            </span>
          </>
        )}
      <span class="price">${item.price}</span>
    </button>
  );
}

/** Replay log download for a failed blind (spec §23 debug requirement). */
function ReplayDownload({ run }: { run: Run }) {
  const url = useMemo(() => {
    const log = {
      seed: run.state.tableId,
      ante: run.state.ante,
      kind: run.kind,
      history: run.blind.state.history.map((r) => ({
        hand: r.hand.category,
        cards: r.hand.cards.map(cardLabel),
        steps: r.steps,
        total: r.total,
      })),
    };
    return URL.createObjectURL(
      new Blob([JSON.stringify(log, null, 2)], { type: "application/json" }),
    );
  }, [run]);
  return (
    <a class="redraw replay-link" href={url} download="super-omaha-replay.json">
      Download replay log
    </a>
  );
}

/** Submit a daily-seed run to the validated leaderboard (scope §16).
 * Only appears for daily runs, and only when signed in. */
function LeaderboardSubmit({ run }: { run: Run }) {
  const [status, setStatus] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const day = run.seed.startsWith("daily-") ? run.seed.slice(6) : null;
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(!!localStorage.getItem("super-omaha/token"));
  }, []);
  if (!day || !signedIn || sent) return null;

  async function submit() {
    const replay = {
      seed: run.seed,
      tableId: run.state.tableId,
      actions: run.actionLog,
      claimed: {
        ante: run.state.ante,
        cash: run.state.cash,
        won: run.state.phase === "won" || run.state.endless,
        phase: run.state.phase,
      },
    };
    const token = localStorage.getItem("super-omaha/token");
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ day, replay }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setSent(true);
      setStatus("Submitted to today's leaderboard.");
    } else {
      setStatus(body.error ?? "Submission failed.");
    }
  }

  return (
    <div>
      <button type="button" class="redraw" onClick={submit}>
        Submit to daily leaderboard
      </button>
      {status && <p class="table-desc">{status}</p>}
    </div>
  );
}
