'use client'

import { useEffect, useState } from 'react'
import { rateParts, rumorActive } from '@/engine/effects'
import { DISPLAY_MS } from '@/engine/machines'
import { formatMoney, type Locale } from '@/i18n'
import type { CardEffect, Machine } from '@/engine/types'

export function liveIncomePerSecond(machines: Machine[], effects: CardEffect[] | undefined, now = Date.now()): number {
  let total = 0
  for (const machine of machines) {
    if (!machine.owned) continue
    const parts = rateParts(machine, effects, now, machines)
    total += parts.owner
  }
  return Math.round(total)
}

export function LiveRate({
  machines,
  effects = [],
  mask = false,
  locale,
  className,
}: {
  machines: Machine[]
  effects?: CardEffect[]
  mask?: boolean
  locale: Locale
  className?: string
}) {
  const [rate, setRate] = useState(() => liveIncomePerSecond(machines, effects))
  const [hidden, setHidden] = useState(false)
  const clock = [
    machines.map((machine) => `${machine.kind}:${machine.workers}:${machine.upgrades}:${machine.owned}`).join('|'),
    effects.map((effect) => `${effect.id}:${effect.until}`).join('|'),
  ].join('~')

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      setHidden(mask && rumorActive(effects, now))
      setRate(liveIncomePerSecond(machines, effects, now))
    }
    tick()
    const interval = window.setInterval(tick, DISPLAY_MS)
    return () => window.clearInterval(interval)
  }, [clock, machines, effects, mask])

  if (hidden) return <span className={className}>¿?</span>
  return (
    <span className={className}>
      <span aria-hidden>▲</span> +{formatMoney(locale, rate).replace(/\s?€$/, '')}/s
    </span>
  )
}
