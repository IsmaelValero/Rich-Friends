import { describe, expect, it } from 'vitest'
import { applyAction } from './actions'
import { settleAll } from './effects'
import type { ShopCard } from './types'
import { addPlayer, createGame, startGame } from './world'

const now = '2026-09-23T18:00:00.000Z'

function table() {
  const state = createGame({ code: 'FX', hostToken: 'host', now })
  const ana = addPlayer(state, { name: 'Ana', token: 'ana', now })
  const bo = addPlayer(state, { name: 'Bo', token: 'bo', now })
  if ('error' in ana || 'error' in bo) throw new Error('seat')
  const started = startGame(state, now)
  if (!started.ok) throw new Error(started.error)
  return { state, ana: ana.player, bo: bo.player }
}

function later(seconds: number) {
  return new Date(Date.parse(now) + seconds * 1000).toISOString()
}

function hold(owner: { hand: ShopCard[] }, card: ShopCard) {
  owner.hand = [card]
}

describe('card effects', () => {
  it('steals all cash when the card is closed', () => {
    const { state, ana, bo } = table()
    bo.cash = 100
    hold(ana, { id: 'rob', pile: 'sabotage', kind: 'robo' })
    expect(applyAction(state, { kind: 'send_card', playerId: ana.id, cardId: 'rob', toId: bo.id }, now).ok).toBe(true)
    expect(bo.cash).toBe(100)
    expect(applyAction(state, { kind: 'close_card', playerId: bo.id, cardId: 'rob', block: false }, now).ok).toBe(true)
    expect(bo.cash).toBe(0)
    expect(ana.cash).toBe(100)
    expect(bo.notices[0]).toMatchObject({ code: 'robbed', name: 'Ana', amount: 100 })
  })

  it('blocks a sabotage and tells both players', () => {
    const { state, ana, bo } = table()
    bo.cash = 100
    bo.active = [{ id: 'esc', pile: 'defense', kind: 'escudo' }]
    hold(ana, { id: 'tax', pile: 'sabotage', kind: 'impuesto' })
    applyAction(state, { kind: 'send_card', playerId: ana.id, cardId: 'tax', toId: bo.id }, now)
    const closed = applyAction(state, { kind: 'close_card', playerId: bo.id, cardId: 'tax', block: true }, now)
    expect(closed.ok).toBe(true)
    expect(bo.cash).toBe(100)
    expect(bo.active).toEqual([])
    expect(bo.notices[0]).toMatchObject({ code: 'blocked', name: 'Ana', card: 'impuesto' })
    expect(ana.notices[0]).toMatchObject({ code: 'bounced', name: 'Bo' })
  })

  it('forces the chosen machine to be bought again', () => {
    const { state, ana, bo } = table()
    const machine = bo.machines.find((entry) => entry.owned)
    if (!machine) throw new Error('machine')
    hold(ana, { id: 'sab', pile: 'sabotage', kind: 'saboteador' })
    applyAction(state, { kind: 'send_card', playerId: ana.id, cardId: 'sab', toId: bo.id, machineId: machine.id }, now)
    applyAction(state, { kind: 'close_card', playerId: bo.id, cardId: 'sab', block: false }, now)
    expect(machine.owned).toBe(false)
    settleAll(state, later(5))
    expect(bo.cash).toBe(0)
  })
})
