import { describe, expect, it } from 'vitest'
import { applyAction } from './actions'
import { MACHINE_LIST } from './machines'
import { addPlayer, createGame, finishGame, maybeFinishByTime, startGame } from './world'

const now = '2026-09-23T18:00:00.000Z'

describe('match clock', () => {
  it('lets you buy the last catalogue machine without ending the game', () => {
    const state = createGame({ code: 'END', hostToken: 'host', now })
    const ana = addPlayer(state, { name: 'Ana', token: 'ana', now })
    const bo = addPlayer(state, { name: 'Bo', token: 'bo', now })
    addPlayer(state, { name: 'Cata', token: 'cata', now })
    addPlayer(state, { name: 'Dani', token: 'dani', now })
    if ('error' in ana || 'error' in bo) throw new Error('seat')
    expect(startGame(state, now).ok).toBe(true)

    const last = ana.player.machines.find((entry) => entry.kind === 'tresmil')
    if (!last) throw new Error('tresmil')
    for (const spec of MACHINE_LIST) {
      if (spec.kind === 'tresmil') continue
      const machine = ana.player.machines.find((entry) => entry.kind === spec.kind)
      if (!machine) throw new Error(spec.kind)
      machine.owned = true
      machine.workers = 1
    }
    ana.player.cash = 5_500_000
    const bought = applyAction(state, { kind: 'buy_machine', playerId: ana.player.id, machineId: last.id }, now)
    expect(bought.ok).toBe(true)
    expect(last.owned).toBe(true)
    expect(state.status).toBe('running')
  })

  it('finishes when the duration elapses and ranks by firm value', () => {
    const state = createGame({
      code: 'CLK',
      hostToken: 'host',
      now,
      config: { durationMs: 60_000 },
    })
    const ana = addPlayer(state, { name: 'Ana', token: 'ana', now })
    const bo = addPlayer(state, { name: 'Bo', token: 'bo', now })
    addPlayer(state, { name: 'Cata', token: 'cata', now })
    addPlayer(state, { name: 'Dani', token: 'dani', now })
    if ('error' in ana || 'error' in bo) throw new Error('seat')
    expect(startGame(state, now).ok).toBe(true)

    // Give Bo a clear lead in firm value.
    const tocha = bo.player.machines.find((entry) => entry.kind === 'tocha')
    if (!tocha) throw new Error('tocha')
    tocha.owned = true
    tocha.workers = 3
    tocha.upgrades = 2

    expect(maybeFinishByTime(state, now)).toBe(false)
    const later = new Date(Date.parse(now) + 60_000).toISOString()
    expect(maybeFinishByTime(state, later)).toBe(true)
    expect(state.status).toBe('finished')
    expect(state.standings[0]?.name).toBe('Bo')
  })

  it('finishGame writes standings', () => {
    const state = createGame({ code: 'FIN', hostToken: 'host', now })
    addPlayer(state, { name: 'Ana', token: 'ana', now })
    addPlayer(state, { name: 'Bo', token: 'bo', now })
    addPlayer(state, { name: 'Cata', token: 'cata', now })
    addPlayer(state, { name: 'Dani', token: 'dani', now })
    expect(startGame(state, now).ok).toBe(true)
    expect(finishGame(state, now).ok).toBe(true)
    expect(state.standings).toHaveLength(4)
  })
})
