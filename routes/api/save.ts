// GET  /api/save        → latest cloud snapshot (or 404)
// PUT  /api/save        → store snapshot (body = RunSnapshot JSON)
// Both require Authorization: Bearer <token>.
import { define } from "../../utils.ts";
import { accountForToken } from "../../server/auth.ts";
import { query } from "../../server/db.ts";
import { parseSnapshot } from "../../core/persist.ts";

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export const handler = define.handlers({
  async GET(ctx) {
    const account = await accountForToken(bearer(ctx.req));
    if (!account) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const rows = await query<{ snapshot: unknown }>(
      "SELECT snapshot FROM saves WHERE account_id = $1",
      [account.id],
    );
    if (!rows.length) {
      return Response.json({ error: "no save" }, { status: 404 });
    }
    return Response.json(rows[0].snapshot);
  },

  async PUT(ctx) {
    const account = await accountForToken(bearer(ctx.req));
    if (!account) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await ctx.req.text();
    const snap = parseSnapshot(body);
    if (!snap) {
      return Response.json({ error: "invalid snapshot" }, { status: 400 });
    }
    await query(
      `INSERT INTO saves (account_id, snapshot) VALUES ($1, $2)
       ON CONFLICT (account_id) DO UPDATE SET snapshot = $2, updated_at = now()`,
      [account.id, body],
    );
    return Response.json({ ok: true });
  },
});
