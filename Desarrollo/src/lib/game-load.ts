import { getLocale, getPlayerToken } from '@/lib/session'
import { buildGameView, buildLobbyView, type GameView, type LobbyView } from '@/lib/view'
import { getStore } from '@/store'
import type { Locale } from '@/i18n'

export type LoadedPage =
  | { kind: 'missing'; locale: Locale }
  | { kind: 'lobby'; locale: Locale; view: LobbyView }
  | { kind: 'join'; locale: Locale; code: string; started: boolean }
  | { kind: 'play'; locale: Locale; view: GameView }

export async function loadGamePage(code: string): Promise<LoadedPage> {
  const locale = await getLocale()
  const store = getStore()
  const state = await store.read(code.toUpperCase())
  if (!state) return { kind: 'missing', locale }

  const token = await getPlayerToken(state.code)

  if (state.status === 'lobby') {
    return { kind: 'lobby', locale, view: buildLobbyView(state, token) }
  }

  const player = state.players.find((entry) => entry.token === token)
  if (!player) {
    return { kind: 'join', locale, code: state.code, started: true }
  }

  return { kind: 'play', locale, view: buildGameView(state, player) }
}
