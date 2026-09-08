// Auth: minimal username/password accounts (scope §14.5 — minimal data).
// SHA-256 + per-user salt for credential hashing; random session tokens
// (30-day expiry). No email, no PII beyond the username.

import { query } from "./db.ts";

const encoder = new TextEncoder();

async function hash(password: string, salt: string): Promise<string> {
  const data = encoder.encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function token(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface Account {
  id: string;
  username: string;
}

export async function register(
  username: string,
  password: string,
): Promise<{ account?: Account; token?: string; error?: string }> {
  if (!/^[a-z0-9_.-]{3,24}$/.test(username)) {
    return { error: "Username: 3–24 chars, lowercase letters, numbers, . _ -" };
  }
  if (password.length < 6) return { error: "Password: at least 6 characters" };
  const salt = token().slice(0, 16);
  const passHash = await hash(password, salt);
  try {
    const rows = await query<Account>(
      "INSERT INTO accounts (username, pass_hash) VALUES ($1, $2) RETURNING id, username",
      [username, `${salt}$${passHash}`],
    );
    return await login(rows[0].id, password, true);
  } catch {
    return { error: "Username taken" };
  }
}

export async function login(
  usernameOrId: string,
  password: string,
  byId = false,
): Promise<{ account?: Account; token?: string; error?: string }> {
  const rows = await query<Account & { pass_hash: string }>(
    byId
      ? "SELECT id, username, pass_hash FROM accounts WHERE id = $1"
      : "SELECT id, username, pass_hash FROM accounts WHERE username = $1",
    [usernameOrId],
  );
  if (!rows.length) return { error: "No such account" };
  const [salt, expected] = rows[0].pass_hash.split("$");
  if ((await hash(password, salt)) !== expected) {
    return { error: "Wrong password" };
  }
  const t = token();
  await query("INSERT INTO sessions (token, account_id) VALUES ($1, $2)", [
    t,
    rows[0].id,
  ]);
  return { account: { id: rows[0].id, username: rows[0].username }, token: t };
}

export async function accountForToken(
  t: string | null,
): Promise<Account | null> {
  if (!t) return null;
  const rows = await query<Account>(
    `SELECT a.id, a.username FROM sessions s
     JOIN accounts a ON a.id = s.account_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [t],
  );
  return rows[0] ?? null;
}
