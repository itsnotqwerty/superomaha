// Account + cloud save + daily leaderboard UI (Phase 2).
// Guest play never requires an account (scope §14.5).
import { useEffect, useState } from "preact/hooks";

const TOKEN_KEY = "super-omaha/token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

interface LeaderboardEntry {
  username: string;
  ante: number;
  cash: number;
  won: boolean;
}

export default function Account() {
  const [username, setUsername] = useState<string | null>(null);
  const [formUser, setFormUser] = useState("");
  const [formPass, setFormPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [boardDay, setBoardDay] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    // Load leaderboard regardless of auth.
    api("/api/leaderboard").then((r) => {
      if (r.ok) {
        setBoard(r.body.entries);
        setBoardDay(r.body.day);
      }
    });
    // Token validation: try fetching the save.
    api("/api/save").then((r) => {
      if (r.status !== 401) {
        setUsername(localStorage.getItem("super-omaha/username"));
      }
    });
    setUsername(localStorage.getItem("super-omaha/username"));
  }, []);

  async function submit(path: "/api/register" | "/api/login") {
    setError(null);
    const r = await api(path, {
      method: "POST",
      body: JSON.stringify({ username: formUser, password: formPass }),
    });
    if (!r.ok) return setError(r.body.error ?? "failed");
    setToken(r.body.token);
    localStorage.setItem("super-omaha/username", r.body.username);
    setUsername(r.body.username);
  }

  async function pushSave() {
    setStatus(null);
    const snap = localStorage.getItem("super-omaha/run/v1");
    if (!snap) return setStatus("No local run to upload.");
    const r = await api("/api/save", { method: "PUT", body: snap });
    setStatus(r.ok ? "Saved to cloud." : `Save failed: ${r.body.error}`);
  }

  async function pullSave() {
    setStatus(null);
    const r = await api("/api/save");
    if (!r.ok) return setStatus(`No cloud save (${r.body.error ?? "404"}).`);
    localStorage.setItem("super-omaha/run/v1", JSON.stringify(r.body));
    setStatus(
      "Cloud save downloaded — Continue saved run on the title screen.",
    );
  }

  function logout() {
    setToken(null);
    localStorage.removeItem("super-omaha/username");
    setUsername(null);
  }

  return (
    <div class="table">
      <h2>Account</h2>
      {username
        ? (
          <>
            <p>
              Signed in as <strong>{username}</strong>
            </p>
            <div class="actions">
              <button type="button" class="redraw" onClick={pushSave}>
                Upload save
              </button>
              <button type="button" class="redraw" onClick={pullSave}>
                Download save
              </button>
              <button type="button" class="redraw" onClick={logout}>
                Sign out
              </button>
            </div>
            {status && <p class="table-desc">{status}</p>}
          </>
        )
        : (
          <>
            <label class="field">
              Username
              <input
                value={formUser}
                onInput={(e) =>
                  setFormUser((e.target as HTMLInputElement).value)}
                autocomplete="username"
              />
            </label>
            <label class="field">
              Password
              <input
                type="password"
                value={formPass}
                onInput={(e) =>
                  setFormPass((e.target as HTMLInputElement).value)}
                autocomplete="current-password"
              />
            </label>
            <div class="actions">
              <button
                type="button"
                class="commit"
                onClick={() => submit("/api/login")}
              >
                Sign in
              </button>
              <button
                type="button"
                class="redraw"
                onClick={() => submit("/api/register")}
              >
                Register
              </button>
            </div>
            {error && <p class="error">{error}</p>}
            <p class="table-desc">
              Accounts are optional — cloud save and the daily leaderboard only.
            </p>
          </>
        )}

      <h3>Daily leaderboard {boardDay && `(${boardDay})`}</h3>
      {board.length === 0
        ? <p class="table-desc">No entries yet today.</p>
        : (
          <ol class="leaderboard">
            {board.map((e, i) => (
              <li key={i}>
                <strong>{e.username}</strong> — ante {e.ante}
                {e.won ? " 🏆" : ""} · ${e.cash}
              </li>
            ))}
          </ol>
        )}
      <a class="tutorial-link" href="/">Back</a>
    </div>
  );
}
