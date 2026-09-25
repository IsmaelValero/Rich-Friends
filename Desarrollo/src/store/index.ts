import { createFileStore } from './file-store'
import { createPostgresStore } from './postgres-store'
import { databaseUrl } from './env'
import type { GameStore } from './types'

let store: GameStore | null = null

/**
 * Picks the store from the environment: PostgreSQL when a connection string is
 * present, JSON files otherwise. Nothing above this line knows which one it got,
 * which is why playing locally needs no setup and deploying needs no code change.
 */
export function getStore(): GameStore {
  if (!store) {
    if (databaseUrl()) {
      store = createPostgresStore()
    } else if (process.env.VERCEL) {
      // On Vercel the filesystem is read-only; falling back to .data/ only hides a
      // missing env var behind a confusing ENOENT.
      throw new Error(
        'DATABASE_URL is missing. In Vercel → Settings → Environment Variables add DATABASE_URL (Supabase Connect → Transaction pooler URI), enable Production AND Preview, then Redeploy.',
      )
    } else {
      store = createFileStore()
    }
  }
  return store
}

export { GameNotFoundError } from './types'
export type { GameStore, GameSummary } from './types'
