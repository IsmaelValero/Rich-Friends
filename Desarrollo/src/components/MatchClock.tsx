'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function MatchClock({
  endsAtMs,
  className = '',
}: {
  endsAtMs: number | null
  className?: string
}) {
  const router = useRouter()
  const [left, setLeft] = useState(() => (endsAtMs == null ? 0 : endsAtMs - Date.now()))

  useEffect(() => {
    if (endsAtMs == null) return
    const tick = () => {
      const remaining = endsAtMs - Date.now()
      setLeft(remaining)
      if (remaining <= 0) router.refresh()
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [endsAtMs, router])

  if (endsAtMs == null) return <span className={className}>--:--</span>

  const urgent = left < 60_000

  return (
    <span className={`${className} ${urgent ? 'is-urgent' : ''}`.trim()} aria-live="polite">
      {formatClock(left)}
    </span>
  )
}
