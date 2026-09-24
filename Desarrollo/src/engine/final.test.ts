import { describe, expect, it } from 'vitest'
import { applyAction } from './actions'
import { MACHINE_LIST } from './machines'
import { addPlayer, createGame, startGame } from './world'

const now = '2026-09-23T18:00:00.000Z'

describe('final machine', () => {
  it('requires the ten machines first, then ends the game', () => {
    const state = createGame({ code: 'END', hostToken: 'host', now })
    const ana = addPlayer(state, { name: 'Ana', token: 'ana', now })
    const bo = addPlayer(state, { name: 'Bo', token: 'bo', now })
    if ('error' in ana || 'error' in bo) throw new Error('seat')
    expect(startGame(state, now).ok).toBe(true)

    const final = ana.player.machines.find((entry) => entry.kind === 'final')
    if (!final) throw new Error('final')
    ana.player.cash = 20_000_000
    expect(applyAction(state, { kind: 'buy_machine', playerId: ana.player.id, machineId: final.id }, now)).toEqual({
      ok: false,
      error: 'need_previous',
    })

    for (const spec of MACHINE_LIST.filter((entry) => !entry.endsGame)) {
      const machine = ana.player.machines.find((entry) => entry.kind === spec.kind)
      if (!machine) throw new Error(spec.kind)
      machine.owned = true
      machine.workers = 1
    }
    ana.player.cash = 20_000_000
    const bought = applyAction(state, { kind: 'buy_machine', playerId: ana.player.id, machineId: final.id }, now)
    expect(bought.ok).toBe(true)
    expect(final.owned).toBe(true)
    expect(state.status).toBe('finished')
    expect(ana.player.cash).toBe(0)
  })
})
