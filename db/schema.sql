-- Super Omaha server schema (spec §13.4 cloud save, §16 validated leaderboard).
-- Apply with: psql -h localhost -U nashtwin -d super_omaha -f db/schema.sql

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_.-]{3,24}$'),
  pass_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
);

-- One cloud save per account (latest in-progress run).
CREATE TABLE IF NOT EXISTS saves (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validated daily leaderboard: one entry per account per day.
CREATE TABLE IF NOT EXISTS leaderboard (
  day DATE NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ante INT NOT NULL,
  cash INT NOT NULL,
  won BOOLEAN NOT NULL,
  replay JSONB NOT NULL, -- seed + action log, server-validated before insert
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, account_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_day_score
  ON leaderboard (day, ante DESC, cash DESC);

CREATE TABLE IF NOT EXISTS collections (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
