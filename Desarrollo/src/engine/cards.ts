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

export function kindsFor(pile: CardPile): readonly CardKind[] {
  return pile === 'sabotage' ? SABOTAGE_KINDS : DEFENSE_KINDS
}
