// GET/PUT /api/collection — cross-run collection sync (same shape as
// localStorage's collection, merged server-side so devices converge).
import { define } from "../../utils.ts";
import { accountForToken } from "../../server/auth.ts";
import { query } from "../../server/db.ts";
import { Collection, EMPTY_COLLECTION } from "../../core/collection.ts";

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

function merge(a: Collection, b: Collection): Collection {
  const union = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return {
    relics: union(a.relics, b.relics),
    bosses: union(a.bosses, b.bosses),
    tables: union(a.tables, b.tables),
    wins: a.wins + b.wins, // client sends deltas; see UI sync
    runs: a.runs + b.runs,
    bestAnte: Math.max(a.bestAnte, b.bestAnte),
  };
}

export const handler = define.handlers({
  async GET(ctx) {
    const account = await accountForToken(bearer(ctx.req));
    if (!account) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const rows = await query<{ data: Collection }>(
      "SELECT data FROM collections WHERE account_id = $1",
      [account.id],
    );
    return Response.json(rows[0]?.data ?? EMPTY_COLLECTION);
  },

  // PUT body is a *delta* (this device's newly seen content) to merge in.
  async PUT(ctx) {
    const account = await accountForToken(bearer(ctx.req));
    if (!account) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const delta = await ctx.req.json().catch(() => null);
    if (!delta) {
      return Response.json({ error: "invalid body" }, { status: 400 });
    }
    const rows = await query<{ data: Collection }>(
      "SELECT data FROM collections WHERE account_id = $1",
      [account.id],
    );
    const merged = merge(rows[0]?.data ?? EMPTY_COLLECTION, {
      ...EMPTY_COLLECTION,
      ...delta,
    });
    await query(
      `INSERT INTO collections (account_id, data) VALUES ($1, $2)
       ON CONFLICT (account_id) DO UPDATE SET data = $2, updated_at = now()`,
      [account.id, JSON.stringify(merged)],
    );
    return Response.json(merged);
  },
});
