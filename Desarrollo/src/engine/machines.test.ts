import { describe, expect, it } from 'vitest'
import {
  assetValue,
  canBuyMachine,
  firmValue,
  incomeOf,
  INCOME_SCALE,
  MACHINE_LIST,
  minuteIncome,
  ratePerSecond,
  upgradePrice,
  workerPrice,
} from './machines'
import type { Machine } from './types'

const start = Date.parse('2026-09-23T18:00:00.000Z')
const since = new Date(start).toISOString()
const first: Machine = { id: 'm1', kind: 'machinucha', since, workers: 1, upgrades: 0, owned: true }
const second: Machine = { id: 'm2', kind: 'maquinita', since, workers: 0, upgrades: 0, owned: false }

describe('machines', () => {
  it('pays the first machine faster with the starting worker', () => {
    expect(incomeOf([first], start + 999, true)).toBe(0)
    expect(incomeOf([first], start + 1_000, true)).toBeCloseTo(4.5 * INCOME_SCALE)
    expect(incomeOf([first], start + 3_000, true)).toBeCloseTo(13.5 * INCOME_SCALE)
  })

  it('adds the base rate on each upgrade, then a linear bonus per worker', () => {
    expect(ratePerSecond({ ...first, upgrades: 1 })).toBeCloseTo(9 * INCOME_SCALE)
    expect(ratePerSecond({ ...first, upgrades: 2 })).toBeCloseTo(13.5 * INCOME_SCALE)
    expect(ratePerSecond({ ...first, upgrades: 5 })).toBeCloseTo(27 * INCOME_SCALE)
    expect(ratePerSecond({ ...first, upgrades: 1, workers: 2 })).toBeCloseTo(12 * INCOME_SCALE)
    expect(ratePerSecond({ ...first, upgrades: 5, workers: 5 })).toBeCloseTo(63 * INCOME_SCALE)
  })

  it('matches the top rates with five upgrades and five workers', () => {
    const tops = [63, 252, 840, 2_520, 6_930, 18_480, 48_300, 121_800, 315_000, 798_000]
    MACHINE_LIST.forEach((spec, index) => {
      const machine: Machine = { id: spec.kind, kind: spec.kind, since, workers: 5, upgrades: 5, owned: true }
      expect(ratePerSecond(machine)).toBeCloseTo(tops[index]! * INCOME_SCALE)
    })
  })

  it('keeps starter upgrades cheap and scales later machines', () => {
    expect(upgradePrice({ ...first, upgrades: 0 })).toBe(18)
    expect(upgradePrice({ ...first, upgrades: 1 })).toBe(35)
    expect(upgradePrice({ id: 'm2', kind: 'maquinita', since, workers: 1, upgrades: 0, owned: true })).toBe(180)
    expect(upgradePrice({ id: 'm3', kind: 'chunga', since, workers: 1, upgrades: 0, owned: true })).toBe(840)
    expect(upgradePrice({ id: 'm3', kind: 'chunga', since, workers: 1, upgrades: 2, owned: true })).toBe(2_500)
  })

  it('prices five upgrades and four extra workers from the starting worker', () => {
    MACHINE_LIST.forEach((spec) => {
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
    expect(assetValue([first])).toBe(1_050)
    expect(minuteIncome([first])).toBeCloseTo(270 * INCOME_SCALE)
    expect(firmValue([first])).toBeCloseTo(1_050 + 270 * INCOME_SCALE)
  })
})
