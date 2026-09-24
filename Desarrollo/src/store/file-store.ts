/**
 * Local development store: one JSON file per game under `.data/`.
 *
 * This exists so the game can be played with no account, no container and no
 * connection string. `npm run dev` and you are in.
 */

import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GameState } from '@/engine/types'
import { migrateCatalogue } from '@/engine/world'
import type { GameStore, GameSummary } from './types'

const ROOT = join(process.cwd(), '.data')
const GAMES = join(ROOT, 'games')
const SNAPSHOTS = join(ROOT, 'snapshots')

/**
 * One promise chain per game code.
 *
 * The dev server is a single process, so serialising mutations in memory is
 * enough to stop two simultaneous clicks reading the same stale balance.
 */
const locks = new Map<string, Promise<unknown>>()

function withLock<T>(code: string, work: () => Promise<T>): Promise<T> {
  const previous = locks.get(code) ?? Promise.resolve()
  const next = previous.then(work, work)
  locks.set(
    code,
    next.catch(() => undefined),
  )
  return next
}

function gamePath(code: string): string {
  return join(GAMES, `${code.toUpperCase()}.json`)
}

async function writeAtomically(path: string, contents: string): Promise<void> {
  // Write beside the target and rename, so a crash mid-write cannot leave a
  // half-serialised game behind.
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, contents, 'utf8')
  await rename(temporary, path)
}

export function createFileStore(): GameStore {
  const ready = (async () => {
    await mkdir(GAMES, { recursive: true })
    await mkdir(SNAPSHOTS, { recursive: true })
  })()

  async function readRaw(code: string): Promise<GameState | null> {
    await ready
    try {
      const contents = await readFile(gamePath(code), 'utf8')
      const state = JSON.parse(contents) as GameState
      if (migrateCatalogue(state)) await writeAtomically(gamePath(code), JSON.stringify(state))
      return state
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  return {
    async create(state) {
      await ready
      await writeAtomically(gamePath(state.code), JSON.stringify(state))
    },

    read: readRaw,

    async mutate(code, mutator) {
      return withLock(code.toUpperCase(), async () => {
        const state = await readRaw(code)
        if (!state) return null
        migrateCatalogue(state)
        const result = mutator(state)
        await writeAtomically(gamePath(code), JSON.stringify(state))
        return { state, result }
      })
    },

    async snapshot(state, round) {
      await ready
      const dir = join(SNAPSHOTS, state.code.toUpperCase())
      await mkdir(dir, { recursive: true })
      await writeAtomically(join(dir, `${String(round).padStart(3, '0')}.json`), JSON.stringify(state))
    },

    async readSnapshots(code) {
      await ready
      const dir = join(SNAPSHOTS, code.toUpperCase())
      try {
        const files = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort()
        return Promise.all(
          files.map(async (name) => ({
            round: Number(name.replace('.json', '')),
            state: JSON.parse(await readFile(join(dir, name), 'utf8')) as GameState,
          })),
        )
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
      }
    },

    async list() {
      await ready
      const files = await readdir(GAMES).catch(() => [] as string[])
      const summaries: GameSummary[] = []
      for (const name of files) {
        if (!name.endsWith('.json')) continue
        const state = await readRaw(name.replace('.json', ''))
        if (!state) continue
        summaries.push({
          code: state.code,
          status: state.status,
          round: 0,
          players: state.players.length,
          updatedAt: state.createdAt,
        })
      }
      return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
  }
}
