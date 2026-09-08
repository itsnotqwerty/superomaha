// POST /api/login { username, password } → { token, username }
import { define } from "../../utils.ts";
import { login } from "../../server/auth.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const body = await ctx.req.json().catch(() => null);
    if (!body?.username || !body?.password) {
      return Response.json({ error: "username and password required" }, {
        status: 400,
      });
    }
    const result = await login(body.username, body.password);
    if (result.error) {
      return Response.json({ error: result.error }, { status: 401 });
    }
    return Response.json({
      token: result.token,
      username: result.account!.username,
    });
  },
});
