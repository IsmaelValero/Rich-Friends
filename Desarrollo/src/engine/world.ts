import { settleAll } from './effects'
import { endsTheGame, isMachineKind, MACHINE_LIST, MAX_PLAYERS, MAX_UPGRADES, MAX_WORKERS, MIN_PLAYERS, START_WORKERS } from './machines'
import { MAX_ACTIVE_DEFENSES } from './cards'
import { createRng } from './rng'
import type { GameConfig, GameState, LogEntry, LogKind, Machine, Player } from './types'

export const DEFAULT_CONFIG: GameConfig = {
  startingCash: 0,
  seed: 1,
}

export function nextId(state: { rng: number }, prefix: string): string {
  const rng = createRng(state.rng)
  const value = Math.floor(rng.next() * 0xffffffff).toString(36)
  state.rng = rng.state()
  return `${prefix}_${value}`
}

export function logEvent(
  state: GameState,
  kind: LogKind,
  audience: LogEntry['audience'],
  data: LogEntry['data'],
  now: string,
): void {
  state.log.push({ id: nextId(state, 'log'), at: now, kind, audience, data })
}

function freshMachines(state: GameState, now: string): Machine[] {
  return MACHINE_LIST.map((spec, index) => ({
    id: nextId(state, 'm'),
    kind: spec.kind,
    since: now,
    workers: index === 0 ? START_WORKERS : 0,
    upgrades: 0,
    owned: index === 0,
  }))
}

export function migrateCatalogue(state: GameState): boolean {
  let changed = false
  if (!state.offers) {
    state.offers = []
    changed = true
  }
  if (!state.loans) {
    state.loans = []
    changed = true
  }
  if (!state.log) {
    state.log = []
    changed = true
  }
  if (!state.standings) {
    state.standings = []
    changed = true
  }
  if (!state.config) {
    state.config = { ...DEFAULT_CONFIG }
    changed = true
  }
  if (state.config.startingCash !== 0) {
    state.config.startingCash = 0
    changed = true
  }
  if (state.startedAt === undefined) {
    state.startedAt = null
    changed = true
  }
  if (state.finishedAt === undefined) {
    state.finishedAt = state.status === 'finished' ? state.startedAt : null
    changed = true
  }

  const now = new Date().toISOString()
  for (const player of state.players ?? []) {
    if (!player.machines) {
      player.machines = []
      changed = true
    }
    if (player.companyValue == null) {
      player.companyValue = 0
      changed = true
    }
    if (!player.hand) {
      player.hand = []
      changed = true
    }
    if (!player.received) {
      player.received = []
      changed = true
    }
    if (!player.active) {
      player.active = []
      changed = true
    } else if (player.active.length > MAX_ACTIVE_DEFENSES) {
      player.active = player.active.slice(0, MAX_ACTIVE_DEFENSES)
      changed = true
    }
    if (!player.incoming) {
      player.incoming = []
      changed = true
    }
    if (!player.effects) {
      player.effects = []
      changed = true
    }
    if (!player.notices) {
      player.notices = []
      changed = true
    }
    if (player.cola == null) {
      player.cola = false
      changed = true
    }
    if (player.pending === undefined) {
      player.pending = null
      changed = true
    }
    if (player.received?.length) {
      player.incoming.push(...player.received)
      player.received = []
      changed = true
    }
    if (state.status !== 'running') {
      if (player.machines.length === 0 && player.cash !== 0) {
        player.cash = 0
        changed = true
      }
      continue
    }
    const catalogue = player.machines.length > 0 && player.machines.every((machine) => isMachineKind(machine.kind))
    if (!catalogue) {
      player.machines = freshMachines(state, now)
      changed = true
      continue
    }
    for (const spec of MACHINE_LIST) {
      if (player.machines.some((machine) => machine.kind === spec.kind)) continue
      player.machines.push({
        id: nextId(state, 'm'),
        kind: spec.kind,
        since: now,
        workers: 0,
        upgrades: 0,
        owned: false,
      })
      changed = true
    }
    player.machines.sort(
      (a, b) => MACHINE_LIST.findIndex((spec) => spec.kind === a.kind) - MACHINE_LIST.findIndex((spec) => spec.kind === b.kind),
    )
    for (const machine of player.machines) {
      if (machine.owned == null) {
        machine.owned = machine.kind === 'machinucha'
        changed = true
      }
      if (!machine.owned) {
        if (machine.workers !== 0) {
          machine.workers = 0
          changed = true
        }
        continue
      }
      if (machine.workers == null || machine.workers < START_WORKERS) {
        machine.workers = START_WORKERS
        changed = true
      }
      if (machine.upgrades == null || machine.upgrades < 0) {
        machine.upgrades = 0
        changed = true
      }
      if (machine.upgrades > MAX_UPGRADES) {
        machine.upgrades = MAX_UPGRADES
        changed = true
      }
      if (machine.workers > MAX_WORKERS) {
        machine.workers = MAX_WORKERS
        changed = true
      }
    }
  }
  if (state.status === 'running' && !state.startedAt) {
    state.startedAt = state.players.find((player) => player.machines[0])?.machines[0]?.since ?? now
    changed = true
  }
  if (settleAll(state, now)) changed = true
  if (state.status === 'running' && state.players.some((owner) => owner.machines?.some((machine) => machine.owned && endsTheGame(machine.kind)))) {
    finishGame(state, now)
    changed = true
  }
  return changed
}

export function createGame(opts: {
  code: string
  hostToken: string
  config?: Partial<GameConfig>
  now: string
}): GameState {
  const config: GameConfig = { ...DEFAULT_CONFIG, ...opts.config }
  const state: GameState = {
    version: 1,
    id: `game_${opts.code.toLowerCase()}`,
    code: opts.code,
    createdAt: opts.now,
    config,
    status: 'lobby',
    startedAt: null,
    finishedAt: null,
    hostToken: opts.hostToken,
    players: [],
    offers: [],
    loans: [],
    log: [],
    standings: [],
    rng: createRng(config.seed).state(),
  }
  logEvent(state, 'game_created', 'public', { code: opts.code }, opts.now)
  return state
}

export function addPlayer(
  state: GameState,
  opts: { name: string; token: string; now: string },
): { player: Player } | { error: string } {
  if (state.status !== 'lobby') return { error: 'game_already_started' }
  if (state.players.length >= MAX_PLAYERS) return { error: 'game_full' }

  const name = opts.name.trim().slice(0, 24)
  if (name.length < 2) return { error: 'name_too_short' }
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: 'name_taken' }
  }

  const player: Player = {
    id: nextId(state, 'p'),
    token: opts.token,
    name,
    isHost: state.players.length === 0,
    cash: state.config.startingCash,
    companyValue: 0,
    machines: [],
    hand: [],
    active: [],
    incoming: [],
    effects: [],
    notices: [],
    cola: false,
    pending: null,
    received: [],
    joinedAt: opts.now,
  }
  state.players.push(player)
  logEvent(state, 'player_joined', 'public', { name: player.name }, opts.now)
  return { player }
}

export function startGame(state: GameState, now: string): { ok: true } | { ok: false; error: string } {
  if (state.status !== 'lobby') return { ok: false, error: 'already_started' }
  if (state.players.length < MIN_PLAYERS) return { ok: false, error: 'need_two_players' }
  if (state.players.length > MAX_PLAYERS) return { ok: false, error: 'game_full' }
  state.status = 'running'
  state.startedAt = now
  for (const player of state.players) {
    player.cash = 0
    player.companyValue = 0
    player.machines = freshMachines(state, now)
    player.hand = []
    player.active = []
    player.incoming = []
    player.effects = []
    player.notices = []
    player.cola = false
    player.pending = null
    player.received = []
  }
  logEvent(state, 'game_started', 'public', { players: state.players.length }, now)
  return { ok: true }
}

export function finishGame(state: GameState, now: string): { ok: true } | { ok: false; error: string } {
  if (state.status === 'finished') return { ok: true }
  if (state.status !== 'running') return { ok: false, error: 'not_running' }
  settleAll(state, now)
  state.status = 'finished'
  state.finishedAt = now
  logEvent(state, 'game_finished', 'public', {}, now)
  return { ok: true }
}
