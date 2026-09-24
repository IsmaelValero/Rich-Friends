import { describe, expect, it } from 'vitest'
import { assetValue, canBuyMachine, firmValue, incomeOf, MACHINE_LIST, minuteIncome, ratePerSecond, upgradePrice, workerPrice } from './machines'
import type { Machine } from './types'

const start = Date.parse('2026-09-23T18:00:00.000Z')
const since = new Date(start).toISOString()
const first: Machine = { id: 'm1', kind: 'machinucha', since, workers: 1, upgrades: 0, owned: true }
const second: Machine = { id: 'm2', kind: 'maquinita', since, workers: 0, upgrades: 0, owned: false }

describe('machines', () => {
  it('pays the first machine 4 per second with the starting worker', () => {
    expect(incomeOf([first], start + 999, true)).toBe(0)
    expect(incomeOf([first], start + 1_000, true)).toBe(4)
    expect(incomeOf([first], start + 3_000, true)).toBe(12)
  })

  it('adds the base rate on each upgrade, then doubles it per worker', () => {
    expect(ratePerSecond({ ...first, upgrades: 1 })).toBe(8)
    expect(ratePerSecond({ ...first, upgrades: 2 })).toBe(12)
    expect(ratePerSecond({ ...first, upgrades: 5 })).toBe(24)
    expect(ratePerSecond({ ...first, upgrades: 1, workers: 2 })).toBe(16)
    expect(ratePerSecond({ ...first, upgrades: 5, workers: 5 })).toBe(384)
  })

  it('matches the top rates with five upgrades and five workers', () => {
    const tops = [384, 1_920, 6_720, 19_200, 53_760, 144_000, 384_000, 1_056_000, 2_688_000, 7_680_000]
    MACHINE_LIST.filter((spec) => !spec.endsGame).forEach((spec, index) => {
      const machine: Machine = { id: spec.kind, kind: spec.kind, since, workers: 5, upgrades: 5, owned: true }
      expect(ratePerSecond(machine)).toBe(tops[index])
    })
  })

  it('prices five upgrades and four extra workers from the starting worker', () => {
    MACHINE_LIST.filter((spec) => !spec.endsGame).forEach((spec) => {
      const machine: Machine = { id: spec.kind, kind: spec.kind, since, workers: 1, upgrades: 0, owned: true }
      let spent = spec.value
      for (let level = 0; level < 5; level++) spent += upgradePrice({ ...machine, upgrades: level })
      for (let workers = 1; workers < 5; workers++) spent += workerPrice({ ...machine, workers })
      expect(spent).toBeGreaterThan(spec.value)
      expect(Number.isInteger(spent)).toBe(true)
    })
  })

  it('keeps a locked machine off and unlocks in order', () => {
    expect(ratePerSecond(second)).toBe(0)
    expect(canBuyMachine([first, second], 'maquinita')).toBe(true)
    expect(canBuyMachine([first, second], 'chunga')).toBe(false)
    expect(incomeOf([second], start + 5_000, true)).toBe(0)
    expect(assetValue([second])).toBe(0)
  })

  it('values the firm as machines + workers + income per minute', () => {
    expect(assetValue([first])).toBe(1_040)
    expect(minuteIncome([first])).toBe(240)
    expect(firmValue([first])).toBe(1_280)
  })
})
