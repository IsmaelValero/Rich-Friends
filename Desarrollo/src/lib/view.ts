import { cashNow, rateParts, siphonsFor, type LiveSiphon } from '@/engine/effects'
import { assetValue, cardPrice, firmValue, MAX_PLAYERS, MIN_PLAYERS } from '@/engine/machines'
import type { AssetBundle, CardEffect, GameNotice, GameState, Loan, Machine, Offer, PendingBuy, Player, ShopCard } from '@/engine/types'

export interface OfferView {
  id: string
  fromId: string
  fromName: string
  toId: string
  toName: string
  give: AssetBundle
  want: AssetBundle
  note?: string
  rejectionNote?: string
  unseen: boolean
  status: Offer['status']
  direction: 'incoming' | 'outgoing'
}

export interface LoanView {
  id: string
  lenderId: string
  lenderName: string
  borrowerId: string
  borrowerName: string
  principal: number
  interest: number
  status: Loan['status']
  proposedByYou: boolean
  awaitingYou: boolean
  unseen: boolean
  rejectionNote?: string
  total: number
}

export interface PlayerSummary {
  id: string
  name: string
  isHost: boolean
  isYou: boolean
  companyValue: number
  assets: number
  settledCash: number
  machines: Machine[]
  cash: number
  effects: CardEffect[]
  siphons: LiveSiphon[]
}

export interface GameView {
  code: string
  status: GameState['status']
  isHost: boolean
  you: {
    id: string
    name: string
    companyValue: number
    assets: number
    settledCash: number
    machines: Machine[]
    cash: number
    effects: CardEffect[]
    siphons: LiveSiphon[]
    hand: ShopCard[]
    active: ShopCard[]
    incoming: Array<ShopCard & { fromName: string }>
    notices: GameNotice[]
    cola: boolean
    pending: PendingBuy | null
    cardPrice: number
    received: Array<ShopCard & { fromName: string }>
  }
  players: PlayerSummary[]
  offers: OfferView[]
  loans: LoanView[]
  finalStandings: Array<{ playerId: string; name: string; total: number; position: number }> | null
}

function nameOf(state: GameState, playerId: string | null): string | null {
  if (!playerId) return null
  return state.players.find((player) => player.id === playerId)?.name ?? null
}

function offerView(state: GameState, viewer: Player, offer: Offer): OfferView {
  return {
    id: offer.id,
    fromId: offer.fromId,
    fromName: nameOf(state, offer.fromId) ?? '?',
    toId: offer.toId,
    toName: nameOf(state, offer.toId) ?? '?',
    give: offer.give,
    want: offer.want,
    note: offer.note,
    rejectionNote: offer.rejectionNote,
    unseen: offer.status === 'rejected' && offer.fromId === viewer.id && !offer.noticed,
    status: offer.status,
    direction: offer.toId === viewer.id ? 'incoming' : 'outgoing',
  }
}

function liveFirmValue(player: Player, nowMs: number): number {
  let incomeMin = 0
  for (const machine of player.machines ?? []) {
    if (!machine.owned) continue
    const parts = rateParts(machine, player.effects, nowMs, player.machines)
    incomeMin += (parts.owner + parts.thief) * 60
  }
  return assetValue(player.machines) + Math.round(incomeMin)
}

function playerSummary(state: GameState, player: Player, viewerId: string, nowMs: number): PlayerSummary {
  const running = state.status === 'running'
  const cash = cashNow(state, player, nowMs, running)
  const assets = assetValue(player.machines)
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    isYou: player.id === viewerId,
    companyValue: liveFirmValue(player, nowMs),
    assets,
    settledCash: Math.round(player.cash),
    machines: player.machines ?? [],
    cash,
    effects: player.effects ?? [],
    siphons: siphonsFor(state, player.id, nowMs),
  }
}

export function buildGameView(state: GameState, viewer: Player): GameView {
  const nowMs = Date.now()
  const players: PlayerSummary[] = state.players
    .map((player) => playerSummary(state, player, viewer.id, nowMs))
    .sort((a, b) => b.companyValue - a.companyValue || b.cash - a.cash || a.name.localeCompare(b.name))

  const offers = state.offers
    .filter((offer) => offer.fromId === viewer.id || offer.toId === viewer.id)
    .map((offer) => offerView(state, viewer, offer))

  const loans: LoanView[] = state.loans
    .filter((loan) => loan.status !== 'pending' || loan.lenderId === viewer.id || loan.borrowerId === viewer.id)
    .map((loan) => {
      const counterparty = loan.proposedBy === loan.lenderId ? loan.borrowerId : loan.lenderId
      return {
        id: loan.id,
        lenderId: loan.lenderId,
        lenderName: nameOf(state, loan.lenderId) ?? '?',
        borrowerId: loan.borrowerId,
        borrowerName: nameOf(state, loan.borrowerId) ?? '?',
        principal: loan.principal,
        interest: loan.interest,
        status: loan.status,
        proposedByYou: loan.proposedBy === viewer.id,
        awaitingYou: loan.status === 'pending' && counterparty === viewer.id,
        unseen: loan.status === 'rejected' && loan.proposedBy === viewer.id && !loan.noticed,
        rejectionNote: loan.rejectionNote,
        total: Math.round(loan.principal * (1 + loan.interest)),
      }
    })

  const finalStandings =
    state.status === 'finished'
      ? state.players
          .map((player) => ({ playerId: player.id, name: player.name, total: firmValue(player.machines) }))
          .sort((a, b) => b.total - a.total)
          .map((row, index) => ({ ...row, position: index + 1 }))
      : null

  return {
    code: state.code,
    status: state.status,
    isHost: viewer.isHost,
    you: {
      ...playerSummary(state, viewer, viewer.id, nowMs),
      hand: viewer.hand ?? [],
      active: viewer.active ?? [],
      incoming: (viewer.incoming ?? []).map((card) => ({
        ...card,
        fromName: nameOf(state, card.fromId ?? null) ?? '?',
      })),
      notices: viewer.notices ?? [],
      cola: viewer.cola ?? false,
      pending: viewer.pending ?? null,
      cardPrice: cardPrice(viewer.machines),
      received: (viewer.received ?? []).map((card) => ({
        ...card,
        fromName: nameOf(state, card.fromId ?? null) ?? '?',
      })),
    },
    players,
    offers,
    loans,
    finalStandings,
  }
}

export function buildLobbyView(state: GameState, viewerToken: string | null) {
  const viewer = state.players.find((player) => player.token === viewerToken) ?? null
  return {
    code: state.code,
    status: state.status,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      isYou: player.id === viewer?.id,
    })),
    isHost: viewer?.isHost ?? false,
    youAreIn: viewer !== null,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
  }
}

export type LobbyView = ReturnType<typeof buildLobbyView>
