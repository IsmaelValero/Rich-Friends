import type { GameState } from '@/engine/types'

export interface GameSummary {
  code: string
  status: GameState['status']
  round: number
  players: number
  updatedAt: string
}

/**
 * Persistence contract.
 *
 * A game is one JSON document. That is not laziness: the engine already treats
 * the world as a single value it transforms, so storing it as one row keeps the
 * two in step and means adding a sector or an asset type never needs a
 * migration. History is kept as a snapshot per round, which is what the brief
 * asks for when it says a full game must be replayable.
 */
export interface GameStore {
  create(state: GameState): Promise<void>

  read(code: string): Promise<GameState | null>

  /**
   * Reads, mutates and writes a game under a lock.
   *
   * Every write goes through here. Two players buying the same last share in the
   * same second must not read the same balance, so the mutation has to be
   * serialised rather than merely fast.
   */
  mutate<T>(code: string, mutator: (state: GameState) => T): Promise<{ state: GameState; result: T } | null>

  /** Stores the state as it was at the end of a round. */
  snapshot(state: GameState, round: number): Promise<void>

  readSnapshots(code: string): Promise<Array<{ round: number; state: GameState }>>

  list(): Promise<GameSummary[]>
}

export class GameNotFoundError extends Error {
  constructor(code: string) {
    super(`Game ${code} not found`)
    this.name = 'GameNotFoundError'
  }
}
