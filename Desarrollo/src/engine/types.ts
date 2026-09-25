/**
 * Players, cash, deals and loans. The catalogue of cities, companies and
 * families is gone; the next game will define what a company is.
 */

export type MachineKind =
  | 'machinucha'
  | 'maquinita'
  | 'chunga'
  | 'maquinote'
  | 'maquinaza'
  | 'tocha'
  | 'dinero'
  | 'maquinorra'
  | 'brutal'
  | 'tresmil'
  | 'final'

export interface Machine {
  id: string
  kind: MachineKind
  since: string
  workers: number
  /** How many times it has been improved. Each one adds the machine's starting income. */
  upgrades: number
  /** Only the first machine is on when the game starts. The rest are bought. */
  owned: boolean
}

export type CardPile = 'sabotage' | 'defense'

export type SabotageKind =
  | 'saboteador'
  | 'becario'
  | 'inspeccion'
  | 'factura'
  | 'robo'
  | 'cunado'
  | 'boton'
  | 'impuesto'
  | 'interes'
  | 'apagon'

export type DefenseKind = 'escudo' | 'seguro' | 'trampa' | 'contraataque' | 'blindaje'

export type CardKind = SabotageKind | DefenseKind

export interface ShopCard {
  id: string
  pile: CardPile
  kind: CardKind
  /** Set once the card has been sent. */
  fromId?: string
  /** Machine chosen for El Saboteador, or protected by Blindaje. */
  machineId?: string
}

export interface CardEffect {
  id: string
  kind: SabotageKind
  fromId: string
  fromName: string
  start: number
  /** Epoch ms. 0 means it lasts until it is paid. */
  until: number
  machineId?: string
  machineId2?: string
  amount?: number
}

export interface GameNotice {
  id: string
  code: 'robbed' | 'blocked' | 'bounced' | 'bill' | 'tax' | 'insurance' | 'trap' | 'empty' | 'interest' | 'queue'
  name: string
  card?: CardKind
  amount?: number
}

export interface PendingBuy {
  kind: 'buy_machine' | 'buy_worker' | 'upgrade_machine'
  machineId: string
  readyAt: number
}

export interface Player {
  id: string
  token: string
  name: string
  isHost: boolean
  /** Settled money. Production still on the machines is added when it is shown or spent. */
  cash: number
  /** Unused store. The number on screen is machines + workers + money. */
  companyValue: number
  machines: Machine[]
  /** Cards bought and not sent or activated yet. */
  hand: ShopCard[]
  /** Defenses turned on. */
  active: ShopCard[]
  /** Sabotages waiting to be read. The effect starts when they are closed. */
  incoming: ShopCard[]
  effects: CardEffect[]
  notices: GameNotice[]
  /** The next purchase takes 15 s to finish. */
  cola: boolean
  pending: PendingBuy | null
  /** Old inbox. Moved into incoming. */
  received: ShopCard[]
  joinedAt: string
}

export interface AssetBundle {
  cash: number
}

export interface Offer {
  id: string
  fromId: string
  toId: string
  give: AssetBundle
  want: AssetBundle
  note?: string
  rejectionNote?: string
  noticed?: boolean
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired'
  createdAt: string
  resolvedAt?: string
  failureReason?: string
}

export interface Loan {
  id: string
  lenderId: string
  borrowerId: string
  principal: number
  /** Total interest as a fraction of principal, e.g. 0.1 = repay 110%. */
  interest: number
  proposedBy: string
  status: 'pending' | 'active' | 'repaid' | 'defaulted' | 'rejected' | 'cancelled' | 'expired'
  rejectionNote?: string
  noticed?: boolean
  resolvedAt?: string
  recovered?: number
  createdAt: string
}

export interface GameConfig {
  startingCash: number
  seed: number
}

export type LogKind = 'game_created' | 'player_joined' | 'game_started' | 'loan_agreed' | 'loan_repaid' | 'offer_accepted' | 'game_finished'

export interface LogEntry {
  id: string
  at: string
  kind: LogKind
  audience: 'public' | string[]
  data: Record<string, string | number | boolean | null>
}

export interface GameState {
  version: 1
  id: string
  code: string
  createdAt: string
  config: GameConfig
  status: 'lobby' | 'running' | 'finished'
  startedAt: string | null
  /** Set when the partida ends; used to purge finished rows after a short TTL. */
  finishedAt: string | null
  hostToken: string
  players: Player[]
  offers: Offer[]
  loans: Loan[]
  log: LogEntry[]
  standings: Array<{ playerId: string; name: string; total: number; position: number }>
  rng: number
}
