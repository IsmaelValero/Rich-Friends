import { firmValue, MACHINE_SPEC, ratePerSecond, START_WORKERS } from './machines'
import { createRng } from './rng'
import { SABOTAGE_KINDS } from './cards'
import type { CardEffect, GameNotice, GameState, Machine, PendingBuy, Player, SabotageKind, ShopCard } from './types'

function nextId(state: { rng: number }, prefix: string): string {
  const rng = createRng(state.rng)
  const value = Math.floor(rng.next() * 0xffffffff).toString(36)
  state.rng = rng.state()
  return `${prefix}_${value}`
}

/** Robo takes everything the player currently has in cash. */
export const ROB_SHARE = 1
/** Factura takes half of current cash. */
export const BILL_SHARE = 0.5
/** Impuesto takes this share of firm value from cash. */
export const TAX_OF_FIRM = 0.3
/** Interés siphons this share of income. */
export const INTEREST_SHARE = 0.5

const STOP: SabotageKind[] = ['boton', 'inspeccion', 'apagon']

export function effectCovers(effect: CardEffect, atMs: number): boolean {
  if (atMs < effect.start) return false
  if (effect.until === 0) return true
  return atMs < effect.until
}

function targets(effect: CardEffect, machineId: string): boolean {
  if (effect.kind === 'interes' || effect.kind === 'apagon') return true
  return effect.machineId === machineId
}

export function rateParts(
  machine: Machine,
  effects: CardEffect[] | undefined,
  atMs: number,
  machines: Machine[],
): { owner: number; thiefId?: string; thief: number } {
  let rate = ratePerSecond(machine)
  const active = (effects ?? []).filter((effect) => effectCovers(effect, atMs) && targets(effect, machine.id))
  if (active.some((effect) => effect.kind === 'becario')) rate /= 2
  if (active.some((effect) => STOP.includes(effect.kind))) return { owner: 0, thief: 0 }
  const stolen = active.find((effect) => effect.kind === 'cunado')
  if (stolen) return { owner: 0, thiefId: stolen.fromId, thief: rate }
  const cut = active.find((effect) => effect.kind === 'interes')
  if (cut) return { owner: rate * (1 - INTEREST_SHARE), thiefId: cut.fromId, thief: rate * INTEREST_SHARE }
  return { owner: rate, thief: 0 }
}

function integrate(machine: Machine, effects: CardEffect[] | undefined, machines: Machine[], start: number, end: number) {
  const cuts = new Set<number>([start, end])
  for (const effect of effects ?? []) {
    if (!targets(effect, machine.id)) continue
    if (effect.start > start && effect.start < end) cuts.add(effect.start)
    if (effect.until > start && effect.until < end) cuts.add(effect.until)
  }
  const points = [...cuts].sort((a, b) => a - b)
  let owner = 0
  const thieves = new Map<string, number>()
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    const parts = rateParts(machine, effects, from, machines)
    const seconds = (to - from) / 1000
    owner += parts.owner * seconds
    if (parts.thiefId && parts.thief) thieves.set(parts.thiefId, (thieves.get(parts.thiefId) ?? 0) + parts.thief * seconds)
  }
  return { owner, thieves }
}

function paidUntil(start: number, nowMs: number): number {
  const seconds = Math.floor((nowMs - start) / 1000)
  if (seconds <= 0) return start
  return start + seconds * 1000
}

function banked(machine: Machine, effects: CardEffect[] | undefined, machines: Machine[], nowMs: number) {
  const start = Date.parse(machine.since)
  const end = paidUntil(start, nowMs)
  if (end <= start) return null
  const raw = integrate(machine, effects, machines, start, end)
  const thieves = new Map<string, number>()
  for (const [id, amount] of raw.thieves) thieves.set(id, Math.floor(amount))
  return { owner: Math.floor(raw.owner), thieves, end }
}

export function settleAll(state: GameState, nowIso: string): boolean {
  if (state.status !== 'running') return false
  const nowMs = Date.parse(nowIso)
  let changed = false
  for (const owner of state.players) {
    if (finishPending(owner, nowMs)) changed = true
    for (const machine of owner.machines ?? []) {
      if (!machine.owned) continue
      const earned = banked(machine, owner.effects, owner.machines, nowMs)
      if (!earned) continue
      owner.cash += earned.owner
      for (const [id, amount] of earned.thieves) {
        const thief = state.players.find((entry) => entry.id === id)
        if (thief) thief.cash += amount
      }
      machine.since = new Date(earned.end).toISOString()
      changed = true
    }
    if (owner.effects?.some((effect) => effect.until !== 0 && effect.until <= nowMs)) {
      owner.effects = owner.effects.filter((effect) => effect.until === 0 || effect.until > nowMs)
      changed = true
    }
  }
  return changed
}

export function owedOwner(player: Player, nowMs: number): number {
  let total = 0
  for (const machine of player.machines ?? []) {
    if (!machine.owned) continue
    total += banked(machine, player.effects, player.machines, nowMs)?.owner ?? 0
  }
  return total
}

export function owedSiphon(state: GameState, playerId: string, nowMs: number): number {
  let total = 0
  for (const owner of state.players) {
    if (owner.id === playerId) continue
    for (const machine of owner.machines ?? []) {
      if (!machine.owned) continue
      total += banked(machine, owner.effects, owner.machines, nowMs)?.thieves.get(playerId) ?? 0
    }
  }
  return total
}

export interface LiveSiphon {
  perSecond: number
  since: string
  until: number
}

export function siphonsFor(state: GameState, playerId: string, nowMs: number): LiveSiphon[] {
  const rows: LiveSiphon[] = []
  for (const owner of state.players) {
    if (owner.id === playerId) continue
    for (const machine of owner.machines ?? []) {
      if (!machine.owned) continue
      const parts = rateParts(machine, owner.effects, nowMs, owner.machines)
      if (parts.thiefId !== playerId || parts.thief <= 0) continue
      const effect = (owner.effects ?? []).find(
        (entry) => effectCovers(entry, nowMs) && entry.fromId === playerId && (entry.kind === 'cunado' || entry.kind === 'interes'),
      )
      const since = Math.max(Date.parse(machine.since), effect?.start ?? 0)
      rows.push({ perSecond: parts.thief, since: new Date(since).toISOString(), until: effect?.until ?? nowMs })
    }
  }
  return rows
}

export function pendingOwnerIncome(machines: Machine[] | undefined, effects: CardEffect[] | undefined, nowMs: number): number {
  let total = 0
  for (const machine of machines ?? []) {
    if (!machine.owned) continue
    total += banked(machine, effects, machines ?? [], nowMs)?.owner ?? 0
  }
  return total
}

export function pendingSiphonIncome(siphons: LiveSiphon[] | undefined, nowMs: number): number {
  let total = 0
  for (const siphon of siphons ?? []) {
    const start = Date.parse(siphon.since)
    const end = siphon.until === 0 ? nowMs : Math.min(nowMs, siphon.until)
    const seconds = Math.floor((end - start) / 1000)
    if (seconds <= 0) continue
    total += Math.floor(siphon.perSecond * seconds)
  }
  return total
}

export function cashNow(state: GameState, player: Player, nowMs: number, running: boolean): number {
  if (!running) return Math.round(player.cash)
  return Math.round(player.cash + owedOwner(player, nowMs) + owedSiphon(state, player.id, nowMs))
}

export function rumorActive(effects: CardEffect[] | undefined, nowMs = Date.now()): boolean {
  void effects
  void nowMs
  return false
}

export type MachineLook =
  | { tone: 'stopped'; by: string; effectId?: string; amount?: number }
  | { tone: 'stolen'; by: string }
  | { tone: 'slow' }
  | { tone: 'interest'; by: string }

export function machineLook(machineId: string, effects: CardEffect[] | undefined, nowMs = Date.now()): MachineLook | null {
  const active = (effects ?? []).filter((effect) => effectCovers(effect, nowMs) && targets(effect, machineId))
  const stopped = active.find((effect) => STOP.includes(effect.kind))
  if (stopped) {
    return {
      tone: 'stopped',
      by: stopped.fromName,
      effectId: stopped.kind === 'inspeccion' ? stopped.id : undefined,
      amount: stopped.amount,
    }
  }
  const stolen = active.find((effect) => effect.kind === 'cunado')
  if (stolen) return { tone: 'stolen', by: stolen.fromName }
  if (active.some((effect) => effect.kind === 'becario')) return { tone: 'slow' }
  const cut = active.find((effect) => effect.kind === 'interes')
  if (cut) return { tone: 'interest', by: cut.fromName }
  return null
}

function ownedMachines(owner: Player): Machine[] {
  return (owner.machines ?? []).filter((machine) => machine.owned)
}

function bestMachine(machines: Machine[]): Machine | undefined {
  return [...machines].sort((a, b) => ratePerSecond(b) - ratePerSecond(a))[0]
}

function notice(state: GameState, code: GameNotice['code'], name: string, card?: GameNotice['card'], amount?: number): GameNotice {
  return { id: nextId(state, 'note'), code, name, card, amount }
}

function remember(owner: Player, entry: GameNotice) {
  if (!owner.notices) owner.notices = []
  owner.notices.push(entry)
}

function takeCash(owner: Player, ratio: number): number {
  const amount = Math.round(Math.max(0, owner.cash) * ratio)
  const taken = Math.min(amount, Math.max(0, Math.floor(owner.cash)))
  owner.cash -= taken
  return taken
}

function defenseFor(owner: Player, machineIds: string[]): ShopCard | undefined {
  const active = owner.active ?? []
  const armor = active.find((card) => card.kind === 'blindaje' && card.machineId && machineIds.includes(card.machineId))
  if (armor) return armor
  return active.find((card) => card.kind === 'contraataque') ?? active.find((card) => card.kind === 'escudo')
}

function consume(owner: Player, card: ShopCard) {
  owner.active = (owner.active ?? []).filter((entry) => entry.id !== card.id)
}

export function closeIncoming(state: GameState, playerId: string, cardId: string, block: boolean, nowIso: string) {
  const defender = state.players.find((entry) => entry.id === playerId)
  const card = defender?.incoming?.find((entry) => entry.id === cardId)
  const attacker = state.players.find((entry) => entry.id === card?.fromId)
  if (!defender || !card || !attacker) return { ok: false as const, error: 'unknown_card' }
  const nowMs = Date.parse(nowIso)
  const machines = ownedMachines(defender)
  const aimed = aim(state, card, machines)
  if (block) {
    const shield = defenseFor(defender, aimed.ids)
    if (!shield) return { ok: false as const, error: 'cannot_block' }
    consume(defender, shield)
    defender.incoming = defender.incoming.filter((entry) => entry.id !== card.id)
    remember(defender, notice(state, 'blocked', attacker.name, card.kind))
    remember(attacker, notice(state, 'bounced', defender.name, card.kind))
    if (shield.kind === 'contraataque') {
      if (!attacker.incoming) attacker.incoming = []
      attacker.incoming.push({ id: nextId(state, 'card'), pile: 'sabotage', kind: card.kind, fromId: defender.id, machineId: card.machineId })
    }
    return { ok: true as const }
  }

  defender.incoming = defender.incoming.filter((entry) => entry.id !== card.id)
  applyHit(state, attacker, defender, card, aimed.machine, aimed.second, nowMs)
  const trap = (defender.active ?? []).find((entry) => entry.kind === 'trampa')
  if (trap) {
    consume(defender, trap)
    reflect(state, attacker, defender, card, nowMs)
  }
  return { ok: true as const }
}

function aim(state: GameState, card: ShopCard, machines: Machine[]) {
  if (card.kind === 'saboteador') {
    const machine = machines.find((entry) => entry.id === card.machineId)
    return { ids: machine ? [machine.id] : [], machine, second: undefined }
  }
  if (card.kind === 'boton' || card.kind === 'cunado' || card.kind === 'becario') {
    const machine = bestMachine(machines)
    return { ids: machine ? [machine.id] : [], machine, second: undefined }
  }
  if (card.kind === 'inspeccion') {
    const rng = createRng(state.rng)
    const machine = machines.length ? rng.pick(machines) : undefined
    state.rng = rng.state()
    return { ids: machine ? [machine.id] : [], machine, second: undefined }
  }
  if (card.kind === 'apagon') {
    return { ids: machines.map((entry) => entry.id), machine: undefined, second: undefined }
  }
  return { ids: [] as string[], machine: undefined, second: undefined }
}

function stamp(state: GameState, kind: SabotageKind, attacker: Player, start: number, until: number, extra: Partial<CardEffect> = {}): CardEffect {
  return { id: nextId(state, 'fx'), kind, fromId: attacker.id, fromName: attacker.name, start, until, ...extra }
}

function applyHit(state: GameState, attacker: Player, defender: Player, card: ShopCard, machine: Machine | undefined, second: Machine | undefined, nowMs: number) {
  void second
  if (!defender.effects) defender.effects = []
  if (card.kind === 'robo') return steal(state, attacker, defender, ROB_SHARE)
  if (card.kind === 'factura') {
    const amount = takeCash(defender, BILL_SHARE)
    attacker.cash += amount
    remember(defender, notice(state, 'bill', attacker.name, card.kind, amount))
    return
  }
  if (card.kind === 'impuesto') {
    const amount = takeAmount(defender, firmValue(defender.machines) * TAX_OF_FIRM)
    attacker.cash += amount
    remember(defender, notice(state, 'tax', attacker.name, card.kind, amount))
    return
  }
  if (card.kind === 'saboteador' && machine) {
    machine.owned = false
    machine.workers = START_WORKERS
    machine.upgrades = 0
    defender.effects = defender.effects.filter((effect) => effect.machineId !== machine.id)
    remember(defender, notice(state, 'empty', attacker.name, card.kind))
    return
  }
  if (card.kind === 'apagon') {
    if (!ownedMachines(defender).length) {
      remember(defender, notice(state, 'empty', attacker.name, card.kind))
      return
    }
    defender.effects.push(stamp(state, 'apagon', attacker, nowMs, nowMs + 5_000))
    return
  }
  if (!machine && card.kind !== 'interes') {
    remember(defender, notice(state, 'empty', attacker.name, card.kind))
    return
  }
  if (card.kind === 'boton' && machine) defender.effects.push(stamp(state, 'boton', attacker, nowMs, nowMs + 10_000, { machineId: machine.id }))
  if (card.kind === 'becario' && machine) defender.effects.push(stamp(state, 'becario', attacker, nowMs, nowMs + 30_000, { machineId: machine.id }))
  if (card.kind === 'cunado' && machine) defender.effects.push(stamp(state, 'cunado', attacker, nowMs, nowMs + 30_000, { machineId: machine.id }))
  if (card.kind === 'inspeccion' && machine) {
    const amount = Math.max(1, Math.round((MACHINE_SPEC[machine.kind]?.value ?? 0) * 0.5))
    defender.effects.push(stamp(state, 'inspeccion', attacker, nowMs, 0, { machineId: machine.id, amount }))
  }
  if (card.kind === 'interes') {
    defender.effects.push(stamp(state, 'interes', attacker, nowMs, nowMs + 20_000))
    remember(defender, notice(state, 'interest', attacker.name, card.kind))
  }
}

function takeAmount(owner: Player, want: number): number {
  const taken = Math.min(Math.max(0, Math.round(want)), Math.max(0, Math.floor(owner.cash)))
  owner.cash -= taken
  return taken
}

function steal(state: GameState, attacker: Player, defender: Player, ratio: number) {
  const amount = takeCash(defender, ratio)
  attacker.cash += amount
  remember(defender, notice(state, 'robbed', attacker.name, 'robo', amount))
  const seguro = (defender.active ?? []).find((card) => card.kind === 'seguro')
  if (seguro && amount > 0) {
    consume(defender, seguro)
    defender.cash += amount
    attacker.cash -= amount
    remember(defender, notice(state, 'insurance', attacker.name, 'robo', amount))
  }
}

function reflect(state: GameState, attacker: Player, defender: Player, card: ShopCard, nowMs: number) {
  void card
  void nowMs
  const rng = createRng(state.rng)
  const kind = rng.pick(SABOTAGE_KINDS)
  state.rng = rng.state()
  if (!attacker.incoming) attacker.incoming = []
  const machineId = kind === 'saboteador' ? bestMachine(ownedMachines(attacker))?.id : undefined
  attacker.incoming.push({
    id: nextId(state, 'card'),
    pile: 'sabotage',
    kind,
    fromId: defender.id,
    machineId,
  })
  remember(attacker, notice(state, 'trap', defender.name, kind))
}

function finishPending(owner: Player, nowMs: number): boolean {
  const pending = owner.pending
  if (!pending || pending.readyAt > nowMs) return false
  owner.pending = null
  const machine = owner.machines?.find((entry) => entry.id === pending.machineId)
  if (!machine) return true
  if (pending.kind === 'buy_machine') {
    machine.owned = true
    machine.workers = START_WORKERS
    machine.upgrades = 0
    machine.since = new Date(nowMs).toISOString()
  } else if (pending.kind === 'buy_worker') machine.workers += 1
  else machine.upgrades += 1
  return true
}

export function holdPurchase(owner: Player, kind: PendingBuy['kind'], machineId: string, nowIso: string): boolean {
  if (owner.pending) return false
  if (!owner.cola) return false
  owner.cola = false
  owner.pending = { kind, machineId, readyAt: Date.parse(nowIso) + 15_000 }
  return true
}
