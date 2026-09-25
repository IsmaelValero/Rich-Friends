'use client'

import { useState } from 'react'
import { leaveGameAction } from '@/app/actions'
import type { Translator } from '@/i18n'

export function LeaveControl({
  code,
  isHost,
  t,
  className = 'btn-leave',
  label,
}: {
  code: string
  isHost: boolean
  t: Translator
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)

  function onClick() {
    if (isHost) {
      setOpen(true)
      return
    }
    void leaveGameAction(code)
  }

  return (
    <>
      <button type="button" className={className} onClick={onClick}>
        {label ?? t('app.leave')}
      </button>

      {open ? (
        <div className="leave-modal" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
          <div className="leave-modal-card sheet px-5 py-5">
            <p id="leave-confirm-title" className="font-display text-center text-xl text-ink">
              {t('app.leaveConfirm')}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="btn-danger w-full px-5 text-sm"
                onClick={() => void leaveGameAction(code)}
              >
                {t('app.leaveConfirmYes')}
              </button>
              <button type="button" className="btn-hire w-full px-5 text-sm" onClick={() => setOpen(false)}>
                {t('app.leaveConfirmNo')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
