import type { GameState, Machine, MachineKind } from './types'

/** The money counter moves once a second. */
export const DISPLAY_MS = 1_000

export const MIN_PLAYERS = 4
export const MAX_PLAYERS = 10

export const WORKER_VALUE = 1_000
export const MAX_UPGRADES = 5
export const MAX_WORKERS = 5
export const START_WORKERS = 1

export const MACHINE_LIST: Array<{
  kind: MachineKind
  value: number
  perSecond: number
  color: string
  tint: string
  /** Buying this machine ends the game for everyone. */
  endsGame?: boolean
}> = [
  { kind: 'machinucha', value: 40, perSecond: 2, color: '#8fb339', tint: '#f4f8e6' },
  { kind: 'maquinita', value: 200, perSecond: 10, color: '#e2a322', tint: '#fff6df' },
  { kind: 'chunga', value: 1_000, perSecond: 35, color: '#f26b3a', tint: '#fff1ea' },
  { kind: 'maquinote', value: 4_000, perSecond: 100, color: '#12b5b0', tint: '#e7f8f7' },
  { kind: 'maquinaza', value: 15_000, perSecond: 280, color: '#3d7eff', tint: '#eaf1ff' },
  { kind: 'tocha', value: 50_000, perSecond: 750, color: '#7c5cff', tint: '#f3efff' },
  { kind: 'dinero', value: 160_000, perSecond: 2_000, color: '#168a45', tint: '#e7f6ec' },
  { kind: 'maquinorra', value: 500_000, perSecond: 5_500, color: '#e15a32', tint: '#fff0eb' },
  { kind: 'brutal', value: 1_500_000, perSecond: 14_000, color: '#b6e033', tint: '#f7fbe4' },
  { kind: 'tresmil', value: 5_000_000, perSecond: 40_000, color: '#ef4f9b', tint: '#ffeff6' },
  { kind: 'final', value: 20_000_000, perSecond: 0, color: '#c9a227', tint: '#fff8e0', endsGame: true },
]

export const MACHINE_SPEC: Record<MachineKind, (typeof MACHINE_LIST)[number]> = Object.fromEntries(
  MACHINE_LIST.map((machine) => [machine.kind, machine]),
) as Record<MachineKind, (typeof MACHINE_LIST)[number]>

export function endsTheGame(kind: MachineKind): boolean {
  return Boolean(MACHINE_SPEC[kind]?.endsGame)
}

const KNOWN_KINDS = new Set<string>(MACHINE_LIST.map((machine) => machine.kind))

export function isMachineKind(kind: string): kind is MachineKind {
  return KNOWN_KINDS.has(kind)
}

/** Income per second. Each upgrade adds the base rate. Each worker doubles it. Off machines earn nothing. */
export function ratePerSecond(machine: Machine): number {
  if (!machine.owned) return 0
  const spec = MACHINE_SPEC[machine.kind]
  if (!spec) return 0
  const steps = Math.max(0, machine.upgrades) + 1
  const workers = Math.max(0, machine.workers)
  return spec.perSecond * steps * 2 ** workers
}

export function upgradePrice(machine: Machine): number {
  const spec = MACHINE_SPEC[machine.kind]
  if (!spec) return 0
  const level = Math.max(0, machine.upgrades)
  return Math.round(spec.value * 0.5 * (level + 1))
}

export function workerPrice(machine: Machine): number {
  const spec = MACHINE_SPEC[machine.kind]
  if (!spec) return 0
  const workers = Math.max(0, machine.workers)
  return Math.round(spec.value * 3 * 1.8 ** workers)
}

/** Buy price of the first machine you still do not own. */
export function nextMachineValue(machines: Machine[] | undefined): number {
  for (const spec of MACHINE_LIST) {
    if (machines?.some((machine) => machine.kind === spec.kind && machine.owned)) continue
    return spec.value
  }
  return MACHINE_LIST[MACHINE_LIST.length - 1]?.value ?? 0
}

/** Sabotages and defenses cost 50% of the next machine. */
export function cardPrice(machines: Machine[] | undefined): number {
  return Math.round(nextMachineValue(machines) * 0.5)
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
