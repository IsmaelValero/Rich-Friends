import { kindsFor, MAX_ACTIVE_DEFENSES } from './cards'
import { closeIncoming, holdPurchase, settleAll } from './effects'
import { cardPrice, canBuyMachine, endsTheGame, MACHINE_SPEC, MAX_UPGRADES, MAX_WORKERS, START_WORKERS, upgradePrice, workerPrice } from './machines'
import { createRng } from './rng'
import { finishGame, logEvent, nextId } from './world'
import type { AssetBundle, CardPile, GameState, Loan, Offer, Player } from './types'

export type GameAction =
  | { kind: 'create_offer'; playerId: string; toId: string; give: AssetBundle; want: AssetBundle; note?: string }
  | { kind: 'respond_offer'; playerId: string; offerId: string; accept: boolean; note?: string }
  | { kind: 'cancel_offer'; playerId: string; offerId: string }
  | { kind: 'dismiss_notice'; playerId: string; offerId?: string; loanId?: string }
  | {
      kind: 'create_loan'
      playerId: string
      toId: string
      role: 'lender' | 'borrower'
      principal: number
      interest: number
    }
  | { kind: 'respond_loan'; playerId: string; loanId: string; accept: boolean; note?: string }
  | { kind: 'repay_loan'; playerId: string; loanId: string }
  | { kind: 'buy_worker'; playerId: string; machineId: string }
  | { kind: 'upgrade_machine'; playerId: string; machineId: string }
  | { kind: 'buy_machine'; playerId: string; machineId: string }
  | { kind: 'buy_card'; playerId: string; pile: CardPile }
  | { kind: 'send_card'; playerId: string; cardId: string; toId: string; machineId?: string }
  | { kind: 'activate_card'; playerId: string; cardId: string; machineId?: string }
  | { kind: 'close_card'; playerId: string; cardId: string; block: boolean }
  | { kind: 'pay_restart'; playerId: string; effectId: string }
  | { kind: 'dismiss_card_notice'; playerId: string; noticeId: string }

export type ActionResult = { ok: true } | { ok: false; error: string }

const ok: ActionResult = { ok: true }
const fail = (error: string): ActionResult => ({ ok: false, error })

function player(state: GameState, id: string): Player | undefined {
  return state.players.find((entry) => entry.id === id)
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

export function emptyBundle(): AssetBundle {
  return { cash: 0 }
}

function sanitiseBundle(raw: AssetBundle | undefined): AssetBundle | null {
  if (!raw || typeof raw !== 'object') return null
  const cash = Math.round(Number(raw.cash) || 0)
  if (!Number.isInteger(cash) || cash < 0) return null
  return { cash }
}

function bundleIsEmpty(bundle: AssetBundle): boolean {
  return bundle.cash <= 0
}

function canDeliver(owner: Player, bundle: AssetBundle): boolean {
  return owner.cash >= bundle.cash
}

function transfer(from: Player, to: Player, bundle: AssetBundle): void {
  from.cash -= bundle.cash
  to.cash += bundle.cash
}

function sanitiseNote(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const note = raw.replace(/\s+/g, ' ').trim().slice(0, 200)
  return note || undefined
}

function createOffer(
  state: GameState,
  playerId: string,
  toId: string,
  rawGive: AssetBundle,
  rawWant: AssetBundle,
  now: string,
  rawNote?: string,
) {
  const from = player(state, playerId)
  const to = player(state, toId)
  if (!from || !to || from.id === to.id) return fail('unknown_target')

  const give = sanitiseBundle(rawGive)
  const want = sanitiseBundle(rawWant)
  if (!give || !want) return fail('invalid_offer')
  if (bundleIsEmpty(give) && bundleIsEmpty(want)) return fail('empty_offer')
  if (!canDeliver(from, give)) return fail('cannot_deliver')

  const offer: Offer = {
    id: nextId(state, 'off'),
    fromId: from.id,
    toId: to.id,
    give,
    want,
    note: sanitiseNote(rawNote),
    status: 'pending',
    createdAt: now,
  }
  state.offers.push(offer)
  return ok
}

function respondOffer(state: GameState, playerId: string, offerId: string, accept: boolean, now: string, rawNote?: string) {
  const offer = state.offers.find((row) => row.id === offerId)
  if (!offer) return fail('unknown_target')
  if (offer.status !== 'pending') return fail('offer_closed')
  if (offer.toId !== playerId) return fail('not_your_offer')

  const from = player(state, offer.fromId)
  const to = player(state, offer.toId)
  if (!from || !to) return fail('unknown_target')

  if (!accept) {
    offer.status = 'rejected'
    offer.resolvedAt = now
    offer.rejectionNote = sanitiseNote(rawNote)
    offer.noticed = false
    return ok
  }

  if (!canDeliver(from, offer.give)) {
    offer.status = 'expired'
    offer.resolvedAt = now
    offer.failureReason = 'proposer_cannot_deliver'
    return fail('proposer_cannot_deliver')
  }
  if (!canDeliver(to, offer.want)) return fail('cannot_deliver')

  transfer(from, to, offer.give)
  transfer(to, from, offer.want)
  offer.status = 'accepted'
  offer.resolvedAt = now
  logEvent(state, 'offer_accepted', [from.id, to.id], { from: from.name, to: to.name }, now)
  return ok
}

function dismissNotice(state: GameState, playerId: string, offerId?: string, loanId?: string) {
  if (offerId) {
    const offer = state.offers.find((row) => row.id === offerId)
    if (!offer || offer.fromId !== playerId || offer.status !== 'rejected') return fail('unknown_target')
    offer.noticed = true
    return ok
  }
  if (loanId) {
    const loan = state.loans.find((row) => row.id === loanId)
    if (!loan || loan.proposedBy !== playerId || loan.status !== 'rejected') return fail('unknown_target')
    loan.noticed = true
    return ok
  }
  return fail('unknown_target')
}

function cancelOffer(state: GameState, playerId: string, offerId: string, now: string) {
  const offer = state.offers.find((row) => row.id === offerId)
  if (!offer) return fail('unknown_target')
  if (offer.fromId !== playerId) return fail('not_your_offer')
  if (offer.status !== 'pending') return fail('offer_closed')
  offer.status = 'cancelled'
  offer.resolvedAt = now
  return ok
}

function proposeLoan(
  state: GameState,
  playerId: string,
  toId: string,
  role: 'lender' | 'borrower',
  principal: number,
  interest: number,
  now: string,
) {
  const proposer = player(state, playerId)
  const other = player(state, toId)
  if (!proposer || !other || proposer.id === other.id) return fail('unknown_target')
  const amount = Math.round(Number(principal) || 0)
  if (!isPositiveInt(amount)) return fail('invalid_amount')
  const rate = Number(interest)
  if (!Number.isFinite(rate) || rate < 0 || rate > 2) return fail('invalid_interest')

  const lenderId = role === 'lender' ? proposer.id : other.id
  const borrowerId = role === 'lender' ? other.id : proposer.id
  if (role === 'lender' && proposer.cash < amount) return fail('insufficient_cash')

  const loan: Loan = {
    id: nextId(state, 'loan'),
    lenderId,
    borrowerId,
    principal: amount,
    interest: Math.round(rate * 1000) / 1000,
    proposedBy: proposer.id,
    status: 'pending',
    createdAt: now,
  }
  state.loans.push(loan)
  return ok
}

function respondLoan(state: GameState, playerId: string, loanId: string, accept: boolean, now: string, rawNote?: string) {
  const loan = state.loans.find((row) => row.id === loanId)
  if (!loan) return fail('unknown_target')
  if (loan.status !== 'pending') return fail('loan_closed')

  const counterparty = loan.proposedBy === loan.lenderId ? loan.borrowerId : loan.lenderId
  if (playerId !== counterparty) return fail('not_your_loan')

  if (!accept) {
    loan.status = 'rejected'
    loan.resolvedAt = now
    loan.rejectionNote = sanitiseNote(rawNote)
    loan.noticed = false
    return ok
  }

  const lender = player(state, loan.lenderId)
  const borrower = player(state, loan.borrowerId)
  if (!lender || !borrower) return fail('unknown_target')
  if (lender.cash < loan.principal) return fail('lender_insufficient_cash')

  lender.cash -= loan.principal
  borrower.cash += loan.principal
  loan.status = 'active'
  logEvent(
    state,
    'loan_agreed',
    'public',
    { lender: lender.name, borrower: borrower.name, principal: loan.principal, interest: loan.interest },
    now,
  )
  return ok
}

function repayLoan(state: GameState, playerId: string, loanId: string, now: string) {
  const loan = state.loans.find((row) => row.id === loanId)
  if (!loan) return fail('unknown_target')
  if (loan.status !== 'active') return fail('loan_closed')
  if (loan.borrowerId !== playerId) return fail('not_your_loan')

  const lender = player(state, loan.lenderId)
  const borrower = player(state, loan.borrowerId)
  if (!lender || !borrower) return fail('unknown_target')

  const total = Math.round(loan.principal * (1 + loan.interest))
  if (borrower.cash < total) return fail('insufficient_cash')

  borrower.cash -= total
  lender.cash += total
  loan.status = 'repaid'
  loan.recovered = total
  logEvent(state, 'loan_repaid', 'public', { lender: lender.name, borrower: borrower.name, amount: total }, now)
  return ok
}

function ownedMachine(state: GameState, playerId: string, machineId: string) {
  if (state.status !== 'running') return fail('not_running')
  const owner = player(state, playerId)
  const machine = owner?.machines.find((entry) => entry.id === machineId)
  if (!owner || !machine) return fail('unknown_target')
  return { owner, machine }
}

function buyWorker(state: GameState, playerId: string, machineId: string, now: string): ActionResult {
  const found = ownedMachine(state, playerId, machineId)
  if ('ok' in found) return found
  if (!found.machine.owned) return fail('not_owned')
  const workers = Math.max(0, found.machine.workers)
  if (workers >= MAX_WORKERS) return fail('max_workers')
  const price = workerPrice(found.machine)
  if (found.owner.cash < price) return fail('insufficient_cash')
  const gate = gatePurchase(found.owner, price, 'buy_worker', machineId, now)
  if (gate !== 'paid') return gate === 'held' ? ok : fail('purchase_pending')
  found.machine.workers = workers + 1
  return ok
}

function upgradeMachine(state: GameState, playerId: string, machineId: string, now: string): ActionResult {
  const found = ownedMachine(state, playerId, machineId)
  if ('ok' in found) return found
  if (!found.machine.owned) return fail('not_owned')
  const level = Math.max(0, found.machine.upgrades)
  if (level >= MAX_UPGRADES) return fail('max_upgrades')
  const price = upgradePrice(found.machine)
  if (found.owner.cash < price) return fail('insufficient_cash')
  const gate = gatePurchase(found.owner, price, 'upgrade_machine', machineId, now)
  if (gate !== 'paid') return gate === 'held' ? ok : fail('purchase_pending')
  found.machine.upgrades = level + 1
  return ok
}

function gatePurchase(owner: Player, price: number, kind: 'buy_machine' | 'buy_worker' | 'upgrade_machine', machineId: string, now: string) {
  if (owner.pending && owner.pending.readyAt > Date.parse(now)) return 'pending' as const
  owner.cash -= price
  if (holdPurchase(owner, kind, machineId, now)) return 'held' as const
  return 'paid' as const
}

function buyCard(state: GameState, playerId: string, pile: CardPile): ActionResult {
  if (state.status !== 'running') return fail('not_running')
  const owner = player(state, playerId)
  if (!owner) return fail('unknown_target')
  if (pile !== 'sabotage' && pile !== 'defense') return fail('unknown_action')
  if (!owner.hand) owner.hand = []
  const price = cardPrice(owner.machines)
  if (owner.cash < price) return fail('insufficient_cash')
  owner.cash -= price
  const rng = createRng(state.rng)
  const kind = rng.pick(kindsFor(pile))
  state.rng = rng.state()
  owner.hand.push({ id: nextId(state, 'card'), pile, kind })
  return ok
}

function sendCard(state: GameState, playerId: string, cardId: string, toId: string, machineId?: string): ActionResult {
  if (state.status !== 'running') return fail('not_running')
  const from = player(state, playerId)
  const to = player(state, toId)
  if (!from || !to || from.id === to.id) return fail('unknown_target')
  if (!from.hand) from.hand = []
  if (!to.incoming) to.incoming = []
  const index = from.hand.findIndex((card) => card.id === cardId)
  if (index < 0) return fail('unknown_card')
  if (from.hand[index].pile !== 'sabotage') return fail('not_sabotage')
  if (from.hand[index].kind === 'saboteador') {
    const machine = to.machines?.find((entry) => entry.id === machineId && entry.owned)
    if (!machine) return fail('need_machine')
  }
  const [card] = from.hand.splice(index, 1)
  to.incoming.push({ ...card, fromId: from.id, machineId: card.kind === 'saboteador' ? machineId : undefined })
  return ok
}

function activateCard(state: GameState, playerId: string, cardId: string, machineId?: string): ActionResult {
  if (state.status !== 'running') return fail('not_running')
  const owner = player(state, playerId)
  if (!owner) return fail('unknown_target')
  if (!owner.hand) owner.hand = []
  if (!owner.active) owner.active = []
  if (owner.active.length >= MAX_ACTIVE_DEFENSES) return fail('max_active_defenses')
  const index = owner.hand.findIndex((card) => card.id === cardId)
  if (index < 0) return fail('unknown_card')
  if (owner.hand[index].pile !== 'defense') return fail('not_defense')
  const [card] = owner.hand.splice(index, 1)
  if (card.kind === 'blindaje') {
    const machine = owner.machines?.find((entry) => entry.id === machineId && entry.owned)
    if (!machine) return fail('need_machine')
    card.machineId = machine.id
  }
  owner.active.push(card)
  return ok
}

function payRestart(state: GameState, playerId: string, effectId: string): ActionResult {
  const owner = player(state, playerId)
  const effect = owner?.effects?.find((entry) => entry.id === effectId && entry.kind === 'inspeccion')
  if (!owner || !effect) return fail('unknown_effect')
  const amount = effect.amount ?? 0
  if (owner.cash < amount) return fail('insufficient_cash')
  owner.cash -= amount
  const attacker = player(state, effect.fromId)
  if (attacker) attacker.cash += amount
  owner.effects = owner.effects.filter((entry) => entry.id !== effect.id)
  return ok
}

function dismissCardNotice(state: GameState, playerId: string, noticeId: string): ActionResult {
  const owner = player(state, playerId)
  if (!owner) return fail('unknown_target')
  owner.notices = (owner.notices ?? []).filter((entry) => entry.id !== noticeId)
  return ok
}

function buyMachine(state: GameState, playerId: string, machineId: string, now: string): ActionResult {
  const found = ownedMachine(state, playerId, machineId)
  if ('ok' in found) return found
  if (found.machine.owned) return fail('already_owned')
  if (!canBuyMachine(found.owner.machines, found.machine.kind)) return fail('need_previous')
  const price = MACHINE_SPEC[found.machine.kind]?.value ?? 0
  if (found.owner.cash < price) return fail('insufficient_cash')
  const gate = gatePurchase(found.owner, price, 'buy_machine', machineId, now)
  if (gate !== 'paid') return gate === 'held' ? ok : fail('purchase_pending')
  found.machine.owned = true
  found.machine.workers = START_WORKERS
  found.machine.upgrades = 0
  found.machine.since = now
  return ok
}

function wonByFinal(state: GameState): boolean {
  return state.players.some((owner) => owner.machines?.some((machine) => machine.owned && endsTheGame(machine.kind)))
}

export function applyAction(state: GameState, action: GameAction, now: string): ActionResult {
  settleAll(state, now)
  if (state.status === 'running' && wonByFinal(state)) finishGame(state, now)
  if (state.status !== 'running' && action.kind !== 'dismiss_notice' && action.kind !== 'dismiss_card_notice') {
    return fail('not_running')
  }
  let result: ActionResult
  switch (action.kind) {
    case 'create_offer':
      result = createOffer(state, action.playerId, action.toId, action.give, action.want, now, action.note)
      break
    case 'respond_offer':
      result = respondOffer(state, action.playerId, action.offerId, action.accept, now, action.note)
      break
    case 'cancel_offer':
      result = cancelOffer(state, action.playerId, action.offerId, now)
      break
    case 'dismiss_notice':
      result = dismissNotice(state, action.playerId, action.offerId, action.loanId)
      break
    case 'create_loan':
      result = proposeLoan(state, action.playerId, action.toId, action.role, action.principal, action.interest, now)
      break
    case 'respond_loan':
      result = respondLoan(state, action.playerId, action.loanId, action.accept, now, action.note)
      break
    case 'repay_loan':
      result = repayLoan(state, action.playerId, action.loanId, now)
      break
    case 'buy_worker':
      result = buyWorker(state, action.playerId, action.machineId, now)
      break
    case 'upgrade_machine':
      result = upgradeMachine(state, action.playerId, action.machineId, now)
      break
    case 'buy_machine':
      result = buyMachine(state, action.playerId, action.machineId, now)
      break
    case 'buy_card':
      result = buyCard(state, action.playerId, action.pile)
      break
    case 'send_card':
      result = sendCard(state, action.playerId, action.cardId, action.toId, action.machineId)
      break
    case 'activate_card':
      result = activateCard(state, action.playerId, action.cardId, action.machineId)
      break
    case 'close_card':
      result = closeIncoming(state, action.playerId, action.cardId, action.block, now)
      break
    case 'pay_restart':
      result = payRestart(state, action.playerId, action.effectId)
      break
    case 'dismiss_card_notice':
      result = dismissCardNotice(state, action.playerId, action.noticeId)
      break
    default:
      result = fail('unknown_action')
  }
  if (result.ok && state.status === 'running' && wonByFinal(state)) finishGame(state, now)
  return result
}
