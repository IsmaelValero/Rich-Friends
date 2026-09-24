'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

function typingInField() {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

export function Poll({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typingInField()) return
      router.refresh()
    }, seconds * 1000)
    const onFocus = () => {
      if (typingInField()) return
      router.refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [router, seconds])

  return null
}
