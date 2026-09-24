'use client'

import { useEffect, useState } from 'react'
import { pendingOwnerIncome, pendingSiphonIncome, rumorActive, type LiveSiphon } from '@/engine/effects'
import { DISPLAY_MS } from '@/engine/machines'
import { formatMoney, type Locale } from '@/i18n'
import type { CardEffect, Machine } from '@/engine/types'

export function liveCash(
  settled: number,
  machines: Machine[],
  running: boolean,
  now = Date.now(),
  effects?: CardEffect[],
  siphons?: LiveSiphon[],
): number {
  if (!running) return Math.round(settled)
  return Math.round(settled + pendingOwnerIncome(machines, effects, now) + pendingSiphonIncome(siphons, now))
}

export function LiveMoney({
  settled,
  machines,
  running,
  initial,
  extra = 0,
  effects = [],
  siphons = [],
  mask = false,
  locale,
  className,
}: {
  settled: number
  machines: Machine[]
  running: boolean
  initial: number
  extra?: number
  effects?: CardEffect[]
  siphons?: LiveSiphon[]
  mask?: boolean
  locale: Locale
  className?: string
}) {
  const [amount, setAmount] = useState(initial)
  const [hidden, setHidden] = useState(false)
  const clock = [
    machines.map((machine) => `${machine.kind}:${machine.since}:${machine.workers}:${machine.upgrades}:${machine.owned}`).join('|'),
    effects.map((effect) => `${effect.id}:${effect.until}`).join('|'),
    siphons.map((siphon) => `${siphon.since}:${siphon.until}:${siphon.perSecond}`).join('|'),
  ].join('~')

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      setHidden(mask && rumorActive(effects, now))
      setAmount(liveCash(settled, machines, running, now, effects, siphons) + extra)
    }
    tick()
    if (!running || (machines.length === 0 && siphons.length === 0)) return
    const anchor = Date.parse(machines[0]?.since ?? siphons[0]?.since ?? new Date().toISOString())
    const wait = DISPLAY_MS - ((Date.now() - anchor) % DISPLAY_MS)
    let interval = 0
    const timeout = window.setTimeout(() => {
      tick()
      interval = window.setInterval(tick, DISPLAY_MS)
    }, wait)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [settled, clock, running, machines, extra, effects, siphons, mask])

  return <span className={className}>{hidden ? '¿?' : formatMoney(locale, amount)}</span>
}
