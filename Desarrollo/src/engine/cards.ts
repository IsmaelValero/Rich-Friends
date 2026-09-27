import type { CardKind, CardPile, DefenseKind, SabotageKind } from './types'

export const SABOTAGE_KINDS: readonly SabotageKind[] = [
  'saboteador',
  'becario',
  'inspeccion',
  'factura',
  'robo',
  'cunado',
  'boton',
  'impuesto',
  'interes',
  'apagon',
]

export const DEFENSE_KINDS: readonly DefenseKind[] = ['escudo', 'seguro', 'trampa', 'contraataque', 'blindaje']

/** At most two defenses can be active at once; the same kind may be used twice. */
export const MAX_ACTIVE_DEFENSES = 2

/** Hand + active defenses, or sabotage cards in hand. */
export const MAX_CARDS_PER_PILE = 2

export function kindsFor(pile: CardPile): readonly CardKind[] {
  return pile === 'sabotage' ? SABOTAGE_KINDS : DEFENSE_KINDS
}

export function sabotageHeldCount(player: { hand?: Array<{ pile: string }> }): number {
  return (player.hand ?? []).filter((card) => card.pile === 'sabotage').length
}

export function defenseHeldCount(player: {
  hand?: Array<{ pile: string }>
  active?: Array<{ pile: string }>
}): number {
  const inHand = (player.hand ?? []).filter((card) => card.pile === 'defense').length
  const active = (player.active ?? []).length
  return inHand + active
}

export function canBuyPile(
  player: { hand?: Array<{ pile: string }>; active?: Array<{ pile: string }> },
  pile: CardPile,
): boolean {
  if (pile === 'sabotage') return sabotageHeldCount(player) < MAX_CARDS_PER_PILE
  return defenseHeldCount(player) < MAX_CARDS_PER_PILE
}
