import { createFileStore } from './file-store'
import { createPostgresStore } from './postgres-store'
import type { GameStore } from './types'

let store: GameStore | null = null

/**
 * Picks the store from the environment: PostgreSQL when a connection string is
 * present, JSON files otherwise. Nothing above this line knows which one it got,
 * which is why playing locally needs no setup and deploying needs no code change.
 */
export function getStore(): GameStore {
  if (!store) {
    store = process.env.DATABASE_URL ? createPostgresStore() : createFileStore()
  }
  return store
}

export { GameNotFoundError } from './types'
export type { GameStore, GameSummary } from './types'
