import { companyWorth } from './machines'
import type { GameState, Player } from './types'

export interface NetWorthBreakdown {
  cash: number
  lent: number
  owed: number
  total: number
}

export function netWorth(state: GameState, player: Player): NetWorthBreakdown {
  let lent = 0
  let owed = 0
  for (const loan of state.loans) {
    if (loan.status !== 'active') continue
    const total = loan.principal * (1 + loan.interest)
    if (loan.lenderId === player.id) lent += total
    if (loan.borrowerId === player.id) owed += total
  }

  return {
    cash: Math.round(player.cash),
    lent: Math.round(lent),
    owed: Math.round(owed),
    total: companyWorth(player, Date.now(), state.status === 'running'),
  }
}

export function standings(state: GameState): Array<{ playerId: string; name: string; total: number }> {
  return state.players
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      total: companyWorth(player, Date.now(), state.status === 'running'),
    }))
    .sort((a, b) => b.total - a.total)
}
