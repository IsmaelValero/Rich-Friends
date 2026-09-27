import type { GameState, Machine, MachineKind } from './types'

/** The money counter moves once a second. */
export const DISPLAY_MS = 1_000

export const MIN_PLAYERS = 1
export const MAX_PLAYERS = 10

export const WORKER_VALUE = 1_000
export const MAX_UPGRADES = 5
export const MAX_WORKERS = 5
export const START_WORKERS = 1

/** Each worker adds this fraction of base income (linear, not explosive). */
export const WORKER_INCOME_BONUS = 0.5

/** Global production scale on top of catalogue rates. */
export const INCOME_SCALE = 1.1

/** Shop cards cost this share of the next unowned machine. */
export const CARD_PRICE_OF_NEXT = 0.4

/** Upgrade cost share of machine value × (level+1). Starter stays cheap. */
export const UPGRADE_COST_SHARE_STARTER = 0.35
export const UPGRADE_COST_SHARE = 0.7

/** Worker hire: value × this × growth^currentWorkers. */
export const WORKER_COST_MULT = 2.5
export const WORKER_COST_GROWTH = 1.7

/**
 * 10 machines paced for a 15‑minute match:
 * slow early, then accelerates so an active player hits 9/10 around minute 12–13
 * and buys/upgrades the last one in the final stretch.
 */
export const MACHINE_LIST: Array<{
  kind: MachineKind
  value: number
  perSecond: number
  color: string
  tint: string
}> = [
  { kind: 'machinucha', value: 50, perSecond: 3, color: '#8fb339', tint: '#f4f8e6' },
  { kind: 'maquinita', value: 250, perSecond: 12, color: '#e2a322', tint: '#fff6df' },
  { kind: 'chunga', value: 1_200, perSecond: 40, color: '#f26b3a', tint: '#fff1ea' },
  { kind: 'maquinote', value: 5_500, perSecond: 120, color: '#12b5b0', tint: '#e7f8f7' },
  { kind: 'maquinaza', value: 22_000, perSecond: 330, color: '#3d7eff', tint: '#eaf1ff' },
  { kind: 'tocha', value: 85_000, perSecond: 880, color: '#7c5cff', tint: '#f3efff' },
  { kind: 'dinero', value: 300_000, perSecond: 2_300, color: '#168a45', tint: '#e7f6ec' },
  { kind: 'maquinorra', value: 950_000, perSecond: 5_800, color: '#e15a32', tint: '#fff0eb' },
  { kind: 'brutal', value: 2_500_000, perSecond: 15_000, color: '#b6e033', tint: '#f7fbe4' },
  { kind: 'tresmil', value: 5_500_000, perSecond: 38_000, color: '#ef4f9b', tint: '#ffeff6' },
]

export const MACHINE_SPEC: Record<MachineKind, (typeof MACHINE_LIST)[number]> = Object.fromEntries(
  MACHINE_LIST.map((machine) => [machine.kind, machine]),
) as Record<MachineKind, (typeof MACHINE_LIST)[number]>

const KNOWN_KINDS = new Set<string>(MACHINE_LIST.map((machine) => machine.kind))

export function isMachineKind(kind: string): kind is MachineKind {
  return KNOWN_KINDS.has(kind)
}

/** Income per second. Each upgrade adds the base rate; each worker adds a linear bonus. */
export function ratePerSecond(machine: Machine): number {
  if (!machine.owned) return 0
  const spec = MACHINE_SPEC[machine.kind]
  if (!spec) return 0
  const steps = Math.max(0, machine.upgrades) + 1
  const workers = Math.max(0, machine.workers)
  return spec.perSecond * steps * (1 + WORKER_INCOME_BONUS * workers) * INCOME_SCALE
}

export function upgradePrice(machine: Machine): number {
  const spec = MACHINE_SPEC[machine.kind]
  if (!spec) return 0
  const level = Math.max(0, machine.upgrades)
  const index = MACHINE_LIST.findIndex((entry) => entry.kind === machine.kind)
  const share = index <= 0 ? UPGRADE_COST_SHARE_STARTER : UPGRADE_COST_SHARE
  return niceRound(spec.value * share * (level + 1))
}

export function workerPrice(machine: Machine): number {
  const spec = MACHINE_SPEC[machine.kind]
  if (!spec) return 0
  const workers = Math.max(0, machine.workers)
  return niceRound(spec.value * WORKER_COST_MULT * WORKER_COST_GROWTH ** workers)
}

/** Buy price of the first machine you still do not own. */
export function nextMachineValue(machines: Machine[] | undefined): number {
  for (const spec of MACHINE_LIST) {
    if (machines?.some((machine) => machine.kind === spec.kind && machine.owned)) continue
    return spec.value
  }
  return MACHINE_LIST[MACHINE_LIST.length - 1]?.value ?? 0
}

/** Sabotages and defenses cost a share of the next machine. */
export function cardPrice(machines: Machine[] | undefined): number {
  return niceRound(nextMachineValue(machines) * CARD_PRICE_OF_NEXT)
}

/** Snap shop/hire prices to readable round numbers (1100, 8800, …). */
export function niceRound(value: number): number {
  const n = Math.max(0, Math.round(value))
  if (n < 20) return n
  if (n < 100) return Math.round(n / 5) * 5
  if (n < 1_000) return Math.round(n / 10) * 10
  if (n < 10_000) return Math.round(n / 100) * 100
  if (n < 100_000) return Math.round(n / 500) * 500
  if (n < 1_000_000) return Math.round(n / 5_000) * 5_000
  if (n < 10_000_000) return Math.round(n / 50_000) * 50_000
  return Math.round(n / 100_000) * 100_000
}

/** True if the previous machine in the catalogue is already owned (or this is the first). */
export function canBuyMachine(machines: Machine[] | undefined, kind: MachineKind): boolean {
  const index = MACHINE_LIST.findIndex((spec) => spec.kind === kind)
  if (index < 0) return false
  if (index === 0) return true
  const previous = MACHINE_LIST[index - 1]
  return Boolean(machines?.some((machine) => machine.kind === previous.kind && machine.owned))
}

export function assetValue(machines: Machine[] | undefined): number {
  if (!machines?.length) return 0
  let total = 0
  for (const machine of machines) {
    if (!machine.owned) continue
    const spec = MACHINE_SPEC[machine.kind]
    if (!spec) continue
    const workers = Math.max(0, machine.workers)
    total += spec.value + workers * WORKER_VALUE
  }
  return total
}

/** Current production of all owned machines, as euros per minute. */
export function minuteIncome(machines: Machine[] | undefined): number {
  if (!machines?.length) return 0
  let total = 0
  for (const machine of machines) {
    if (!machine.owned) continue
    total += ratePerSecond(machine) * 60
  }
  return Math.round(total)
}

/** Machines + workers + income/min. Cash is separate. */
export function firmValue(machines: Machine[] | undefined): number {
  return assetValue(machines) + minuteIncome(machines)
}

export function incomeOf(machines: Machine[] | undefined, nowMs: number, running: boolean): number {
  if (!running || !machines?.length) return 0
  let total = 0
  for (const machine of machines) {
    if (!machine.owned) continue
    const elapsed = nowMs - Date.parse(machine.since)
    if (elapsed < DISPLAY_MS) continue
    const seconds = Math.floor(elapsed / DISPLAY_MS)
    total += seconds * ratePerSecond(machine)
  }
  return total
}

export function moneyOf(player: { cash: number; machines?: Machine[] }, nowMs: number, running: boolean): number {
  return Math.round(player.cash + incomeOf(player.machines, nowMs, running))
}

export function companyWorth(player: { cash: number; machines?: Machine[] }, _nowMs: number, _running: boolean): number {
  return Math.round(player.cash) + firmValue(player.machines)
}

/** Folds elapsed production into cash and moves each machine forward to the last full second. */
export function settleIncome(state: GameState, nowIso: string): void {
  if (state.status !== 'running') return
  const now = Date.parse(nowIso)
  for (const player of state.players) {
    if (!player.machines) continue
    for (const machine of player.machines) {
      if (!machine.owned) continue
      const elapsed = now - Date.parse(machine.since)
      if (elapsed < DISPLAY_MS) continue
      const seconds = Math.floor(elapsed / DISPLAY_MS)
      player.cash += seconds * ratePerSecond(machine)
      machine.since = new Date(Date.parse(machine.since) + seconds * DISPLAY_MS).toISOString()
    }
  }
}
