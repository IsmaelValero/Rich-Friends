/**
 * Production store: PostgreSQL, one row per game.
 *
 * Mutations take a row lock, which matters more here than locally: on Vercel the
 * same game can be hit by several serverless invocations at once, and two players
 * must never buy the same last share off the same stale balance.
 */

import { Pool } from 'pg'
import type { GameState } from '@/engine/types'
import { migrateCatalogue } from '@/engine/world'
import { databaseUrl } from './env'
import type { GameStore, GameSummary } from './types'

let pool: Pool | null = null
let schemaReady: Promise<void> | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = databaseUrl()
    if (!connectionString) throw new Error('DATABASE_URL / POSTGRES_URL is not set')
    pool = new Pool({
      connectionString,
      // Hosted Postgres (Supabase pooler) terminates TLS with their own chain.
      ssl: { rejectUnauthorized: false },
      // One connection per warm serverless instance — transaction pooler friendly.
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    })
  }
  return pool
}

/** Created on first use so deploying needs no migration step.
 * Prefer running `supabase/schema.sql` once in Supabase for indexes/RLS/cleanup. */
async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await getPool().connect()
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS games (
            code       TEXT PRIMARY KEY,
            state      JSONB NOT NULL,
            status     TEXT NOT NULL,
            round      INTEGER NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          CREATE TABLE IF NOT EXISTS game_snapshots (
            code       TEXT NOT NULL REFERENCES games (code) ON DELETE CASCADE,
            round      INTEGER NOT NULL,
            state      JSONB NOT NULL,
            taken_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (code, round)
          );
        `)
      } finally {
        client.release()
      }
    })().catch((error) => {
      // Let the next request retry rather than caching the failure forever.
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

export function createPostgresStore(): GameStore {
  return {
    async create(state) {
      await ensureSchema()
      await getPool().query(
        `INSERT INTO games (code, state, status, round) VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO NOTHING`,
        [state.code.toUpperCase(), state, state.status, 0],
      )
    },

    async read(code) {
      await ensureSchema()
      const { rows } = await getPool().query<{ state: GameState }>(
        `SELECT state FROM games WHERE code = $1`,
        [code.toUpperCase()],
      )
      const state = rows[0]?.state
      if (!state) return null
      migrateCatalogue(state)
      return state
    },

    async mutate(code, mutator) {
      await ensureSchema()
      const client = await getPool().connect()
      try {
        await client.query('BEGIN')
        const { rows } = await client.query<{ state: GameState }>(
          `SELECT state FROM games WHERE code = $1 FOR UPDATE`,
          [code.toUpperCase()],
        )
        const state = rows[0]?.state
        if (!state) {
          await client.query('ROLLBACK')
          return null
        }

        migrateCatalogue(state)
        const result = mutator(state)
        await client.query(
          `UPDATE games SET state = $2, status = $3, round = $4, updated_at = now() WHERE code = $1`,
          [code.toUpperCase(), state, state.status, 0],
        )
        await client.query('COMMIT')
        return { state, result }
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error
      } finally {
        client.release()
      }
    },

    async snapshot(state, round) {
      await ensureSchema()
      await getPool().query(
        `INSERT INTO game_snapshots (code, round, state) VALUES ($1, $2, $3)
         ON CONFLICT (code, round) DO UPDATE SET state = EXCLUDED.state, taken_at = now()`,
        [state.code.toUpperCase(), round, state],
      )
    },

    async readSnapshots(code) {
      await ensureSchema()
      const { rows } = await getPool().query<{ round: number; state: GameState }>(
        `SELECT round, state FROM game_snapshots WHERE code = $1 ORDER BY round`,
        [code.toUpperCase()],
      )
      return rows
    },

    async list() {
      await ensureSchema()
      const { rows } = await getPool().query<{
        code: string
        status: GameState['status']
        round: number
        players: number
        updated_at: Date
      }>(
        `SELECT code, status, round, jsonb_array_length(state -> 'players') AS players, updated_at
         FROM games ORDER BY updated_at DESC LIMIT 50`,
      )
      return rows.map(
        (row): GameSummary => ({
          code: row.code,
          status: row.status,
          round: row.round,
          players: Number(row.players),
          updatedAt: row.updated_at.toISOString(),
        }),
      )
    },

    async delete(code) {
      await ensureSchema()
      // Snapshots cascade via FK when schema.sql / ensureSchema was applied.
      await getPool().query(`DELETE FROM games WHERE code = $1`, [code.toUpperCase()])
      await getPool().query(`DELETE FROM game_snapshots WHERE code = $1`, [code.toUpperCase()])
    },

    async purgeFinished(maxAgeMs = 2 * 60 * 60 * 1000) {
      await ensureSchema()
      const seconds = Math.max(60, Math.floor(maxAgeMs / 1000))
      const { rowCount } = await getPool().query(
        `DELETE FROM games
         WHERE status = 'finished'
           AND updated_at < now() - make_interval(secs => $1)`,
        [seconds],
      )
      return rowCount ?? 0
    },
  }
}
