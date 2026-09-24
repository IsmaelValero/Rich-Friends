'use client'

import { useEffect, useState } from 'react'
import { rateParts } from '@/engine/effects'
import { assetValue, DISPLAY_MS } from '@/engine/machines'
import { formatMoney, type Locale } from '@/i18n'
import type { CardEffect, Machine } from '@/engine/types'

export function liveFirm(machines: Machine[], effects: CardEffect[] | undefined, now = Date.now()): number {
  let incomeMin = 0
  for (const machine of machines) {
    if (!machine.owned) continue
    const parts = rateParts(machine, effects, now, machines)
    incomeMin += (parts.owner + parts.thief) * 60
  }
  return assetValue(machines) + Math.round(incomeMin)
}

export function LiveFirm({
  machines,
  effects = [],
  initial,
  mask = false,
  locale,
  className,
}: {
  machines: Machine[]
  effects?: CardEffect[]
  initial: number
  mask?: boolean
  locale: Locale
  className?: string
}) {
  const [amount, setAmount] = useState(initial)
  const [hidden, setHidden] = useState(false)
  const clock = [
    machines.map((machine) => `${machine.kind}:${machine.workers}:${machine.upgrades}:${machine.owned}`).join('|'),
    effects.map((effect) => `${effect.id}:${effect.until}`).join('|'),
  ].join('~')

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      setHidden(false)
      setAmount(liveFirm(machines, effects, now))
    }
    tick()
    const interval = window.setInterval(tick, DISPLAY_MS)
    return () => window.clearInterval(interval)
  }, [clock, machines, effects, mask])

  return <span className={className}>{hidden ? '¿?' : formatMoney(locale, amount)}</span>
}
