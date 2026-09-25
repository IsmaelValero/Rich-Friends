'use server'

import { randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  addPlayer,
  applyAction,
  createGame,
  DEFAULT_CONFIG,
  startGame,
  type GameAction,
} from '@/engine'
import { isLocale, type Locale } from '@/i18n'
import { createGameCode, createToken, clearHostToken, clearPlayerToken, getPlayerToken, setHostToken, setLocale, setPlayerToken } from '@/lib/session'
import { getStore } from '@/store'

export type FormState = { error: string | null }
export type ClientAction = DistributiveOmit<GameAction, 'playerId'>
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

const ok: FormState = { error: null }
const fail = (error: string): FormState => ({ error })

function now() {
  return new Date().toISOString()
}

function pathFor(code: string) {
  return `/g/${code.toUpperCase()}`
}

export async function changeLocale(locale: string) {
  if (!isLocale(locale)) return
  await setLocale(locale as Locale)
}

export async function createGameAction(_prev: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get('name') ?? '')
  const token = createToken()
  const hostToken = createToken()
  const code = createGameCode()
  const store = getStore()

  const state = createGame({
    code,
    hostToken,
    now: now(),
    config: {
      ...DEFAULT_CONFIG,
      seed: randomInt(1, 1_000_000_000),
    },
  })

  const joined = addPlayer(state, { name, token, now: now() })
  if ('error' in joined) return fail(joined.error)

  try {
    await store.create(state)
  } catch (error) {
    console.error('createGame failed', error)
    return fail('database_unavailable')
  }
  // Drop finished partidas that nobody left behind, so Supabase stays lean.
  void store.purgeFinished().catch(() => undefined)
  await setPlayerToken(code, token)
  await setHostToken(code, hostToken)
  redirect(pathFor(code))
}

export async function joinGameAction(_prev: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get('name') ?? '')
  const code = String(form.get('code') ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
  if (!code) return fail('game_not_found')

  const store = getStore()
  const existingToken = await getPlayerToken(code)
  const state = await store.read(code)
  if (!state) return fail('game_not_found')

  if (existingToken && state.players.some((player) => player.token === existingToken)) {
    redirect(pathFor(code))
  }

  const token = createToken()
  const result = await store.mutate(code, (current) => addPlayer(current, { name, token, now: now() }))
  if (!result) return fail('game_not_found')
  if ('error' in result.result) return fail(result.result.error)

  await setPlayerToken(code, token)
  redirect(pathFor(code))
}

export async function startGameAction(code: string): Promise<FormState> {
  const store = getStore()
  const token = await getPlayerToken(code)
  const result = await store.mutate(code, (state) => {
    const player = state.players.find((entry) => entry.token === token)
    if (!player?.isHost) return { ok: false as const, error: 'not_host' }
    return startGame(state, now())
  })
  if (!result) return fail('game_not_found')
  if (!result.result.ok) return fail(result.result.error)
  revalidatePath(pathFor(code))
  return ok
}

export async function playAction(code: string, action: ClientAction): Promise<FormState> {
  const store = getStore()
  const token = await getPlayerToken(code)
  const result = await store.mutate(code, (state) => {
    const player = state.players.find((entry) => entry.token === token)
    if (!player) return { ok: false as const, error: 'unknown_target' }
    return applyAction(state, { ...action, playerId: player.id } as GameAction, now())
  })
  if (!result) return fail('game_not_found')
  if (!result.result.ok) return fail(result.result.error)
  revalidatePath(pathFor(code))
  return ok
}

export async function leaveGameAction(code: string): Promise<void> {
  const store = getStore()
  const key = code.toUpperCase()
  try {
    const token = await getPlayerToken(code)
    const state = await store.read(key)
    const player = state?.players.find((entry) => entry.token === token)
    // Host leaving (or anyone leaving a finished game) wipes the partida completely.
    if (player?.isHost || state?.status === 'finished') {
      await store.delete(key)
    }
    await store.purgeFinished()
  } catch {
    // Leaving must still work if the DB is briefly unreachable.
  }
  await clearPlayerToken(code)
  await clearHostToken(code)
  redirect('/')
}
