'use client'

import { useEffect } from 'react'

export function HideDevChrome() {
  useEffect(() => {
    const hide = () => {
      document.querySelectorAll('nextjs-portal').forEach((node) => {
        const el = node as HTMLElement
        el.style.setProperty('display', 'none', 'important')
        el.setAttribute('hidden', '')
      })
    }
    hide()
    const observer = new MutationObserver(hide)
    observer.observe(document.documentElement, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return null
}
