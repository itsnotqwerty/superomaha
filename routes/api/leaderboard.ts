// GET  /api/leaderboard?day=YYYY-MM-DD  → top 20 entries for the daily seed
// POST /api/leaderboard { day, replay } → validate + submit (auth required)
import { define } from "../../utils.ts";
import { accountForToken } from "../../server/auth.ts";
import { query } from "../../server/db.ts";
import { Replay, validateReplay } from "../../server/validate.ts";

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const day = url.searchParams.get("day") ?? today();
    const rows = await query<{
      username: string;
      ante: number;
      cash: number;
      won: boolean;
      submitted_at: string;
    }>(
      `SELECT a.username, l.ante, l.cash, l.won, l.submitted_at
       FROM leaderboard l JOIN accounts a ON a.id = l.account_id
       WHERE l.day = $1
       ORDER BY l.won DESC, l.ante DESC, l.cash DESC, l.submitted_at ASC
       LIMIT 20`,
      [day],
    );
    return Response.json({ day, seed: `daily-${day}`, entries: rows });
  },

  async POST(ctx) {
    const account = await accountForToken(bearer(ctx.req));
    if (!account) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await ctx.req.json().catch(() => null);
    if (!body?.day || !body?.replay) {
      return Response.json({ error: "day and replay required" }, {
        status: 400,
      });
    }
    // Only the genuine daily seed may be submitted.
    if (body.replay.seed !== `daily-${body.day}`) {
      return Response.json({ error: "seed does not match day" }, {
        status: 400,
      });
    }
    if (body.day > today()) {
      return Response.json({ error: "future day" }, { status: 400 });
    }
    const result = validateReplay(body.replay as Replay);
    if (!result.valid) {
      return Response.json({ error: result.error }, { status: 422 });
    }
    const c = body.replay.claimed;
    await query(
      `INSERT INTO leaderboard (day, account_id, ante, cash, won, replay)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (day, account_id) DO UPDATE SET
         ante = EXCLUDED.ante, cash = EXCLUDED.cash, won = EXCLUDED.won,
         replay = EXCLUDED.replay, submitted_at = now()
       WHERE EXCLUDED.won OR leaderboard.won = false`,
      [
        body.day,
        account.id,
        c.ante,
        c.cash,
        c.won,
        JSON.stringify(body.replay),
      ],
    );
    return Response.json({ ok: true });
  },
});
