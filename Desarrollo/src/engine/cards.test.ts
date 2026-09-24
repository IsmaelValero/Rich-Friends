import { describe, expect, it } from 'vitest'
import { applyAction } from './actions'
import { DEFENSE_KINDS, SABOTAGE_KINDS } from './cards'
import { cardPrice } from './machines'
import { addPlayer, createGame, startGame } from './world'

const now = '2026-09-23T18:00:00.000Z'

function table() {
  const state = createGame({ code: 'SHOP', hostToken: 'host', now })
  const ana = addPlayer(state, { name: 'Ana', token: 'ana', now })
  const bo = addPlayer(state, { name: 'Bo', token: 'bo', now })
  if ('error' in ana || 'error' in bo) throw new Error('seat')
  const started = startGame(state, now)
  if (!started.ok) throw new Error(started.error)
  return { state, ana: ana.player, bo: bo.player }
}

describe('shop cards', () => {
  it('charges 50% of the next machine and sends the card', () => {
    const { state, ana, bo } = table()
    ana.cash = 200
    const price = cardPrice(ana.machines)
    expect(price).toBe(100)
    const bought = applyAction(state, { kind: 'buy_card', playerId: ana.id, pile: 'sabotage' }, now)
    expect(bought.ok).toBe(true)
    expect(ana.hand).toHaveLength(1)
    expect(ana.hand[0]?.pile).toBe('sabotage')
    expect(SABOTAGE_KINDS).toContain(ana.hand[0]?.kind)
    expect(ana.cash).toBe(100)

    const card = ana.hand[0]
    const sent = applyAction(state, { kind: 'send_card', playerId: ana.id, cardId: card.id, toId: bo.id }, now)
    expect(sent.ok).toBe(true)
    expect(ana.hand).toHaveLength(0)
    expect(bo.incoming).toEqual([{ id: card.id, pile: 'sabotage', kind: card.kind, fromId: ana.id }])
  })

  it('activates a defense instead of sending it', () => {
    const { state, ana, bo } = table()
    ana.cash = 2_000
    const kinds = new Set<string>()
    for (let i = 0; i < 12; i++) {
      applyAction(state, { kind: 'buy_card', playerId: ana.id, pile: 'defense' }, now)
      kinds.add(ana.hand.at(-1)?.kind ?? '')
    }
    expect([...kinds].every((kind) => (DEFENSE_KINDS as readonly string[]).includes(kind))).toBe(true)
    expect(kinds.size).toBeGreaterThan(1)
    const card = ana.hand[0]
    const sent = applyAction(state, { kind: 'send_card', playerId: ana.id, cardId: card.id, toId: bo.id }, now)
    expect(sent).toEqual({ ok: false, error: 'not_sabotage' })
    const activated = applyAction(state, { kind: 'activate_card', playerId: ana.id, cardId: card.id }, now)
    expect(activated.ok).toBe(true)
    expect(ana.hand.some((entry) => entry.id === card.id)).toBe(false)
    expect(ana.active).toEqual([card])
  })

  it('allows the same defense twice but blocks a third active slot', () => {
    const { state, ana } = table()
    ana.cash = 10_000
    ana.hand = [
      { id: 'd1', pile: 'defense', kind: 'escudo' },
      { id: 'd2', pile: 'defense', kind: 'escudo' },
      { id: 'd3', pile: 'defense', kind: 'seguro' },
    ]
    expect(applyAction(state, { kind: 'activate_card', playerId: ana.id, cardId: 'd1' }, now).ok).toBe(true)
    expect(applyAction(state, { kind: 'activate_card', playerId: ana.id, cardId: 'd2' }, now).ok).toBe(true)
    expect(ana.active.map((card) => card.kind)).toEqual(['escudo', 'escudo'])
    expect(applyAction(state, { kind: 'activate_card', playerId: ana.id, cardId: 'd3' }, now)).toEqual({
      ok: false,
      error: 'max_active_defenses',
    })
    expect(ana.hand.map((card) => card.id)).toEqual(['d3'])
  })

  it('refuses a card when there is not enough cash', () => {
    const { state, ana } = table()
    ana.cash = 5
    expect(applyAction(state, { kind: 'buy_card', playerId: ana.id, pile: 'sabotage' }, now)).toEqual({
      ok: false,
      error: 'insufficient_cash',
    })
    expect(ana.hand).toEqual([])
  })
})
