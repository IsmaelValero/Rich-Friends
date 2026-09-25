-- Rich Friends — schema for Supabase / Postgres
-- Run this in the Supabase SQL Editor (or via CLI migration).
-- The Next.js app connects with DATABASE_URL (server-side only).

-- ---------------------------------------------------------------------------
-- Games: one row per partida. Full engine state lives in `state` (JSONB).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
  code       TEXT PRIMARY KEY,
  state      JSONB NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('lobby', 'running', 'finished')),
  round      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS games_status_updated_idx
  ON games (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS games_updated_idx
  ON games (updated_at DESC);

-- ---------------------------------------------------------------------------
-- Optional round snapshots (kept for replay / history if used).
-- Deleted together with the game when the partida ends.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_snapshots (
  code       TEXT NOT NULL,
  round      INTEGER NOT NULL,
  state      JSONB NOT NULL,
  taken_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, round)
);

-- Ensure FK + cascade even if the table already existed without them.
DO $$
BEGIN
  ALTER TABLE game_snapshots
    ADD CONSTRAINT game_snapshots_code_fkey
    FOREIGN KEY (code) REFERENCES games (code) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS game_snapshots_code_idx
  ON game_snapshots (code);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The app talks to Postgres with DATABASE_URL (service / server connection).
-- PostgREST anon/authenticated must not read or write these tables.
-- ---------------------------------------------------------------------------
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE games FROM anon, authenticated;
REVOKE ALL ON TABLE game_snapshots FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cleanup helper: remove finished games (and cascaded snapshots) older than
-- `max_age`. Call from the SQL editor, a cron, or the app after finish.
-- Default: 2 hours — enough for players to see the results screen.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_finished_games(max_age INTERVAL DEFAULT INTERVAL '2 hours')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM games
  WHERE status = 'finished'
    AND updated_at < now() - max_age;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION purge_finished_games(INTERVAL) FROM PUBLIC;
-- Grant only to roles that run server jobs if you add a cron later.
