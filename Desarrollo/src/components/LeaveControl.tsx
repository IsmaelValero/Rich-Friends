'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { leaveGameAction } from '@/app/actions'
import { ExitIcon } from '@/components/Icons'
import type { Translator } from '@/i18n'

export function LeaveControl({
  code,
  isHost,
  t,
  className = 'btn-leave',
  label,
  iconOnly = false,
}: {
  code: string
  isHost: boolean
  t: Translator
  className?: string
  label?: string
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)

  function onClick() {
    if (isHost) {
      setOpen(true)
      return
    }
    void leaveGameAction(code)
  }

  const modal =
    open && typeof document !== 'undefined'
      ? createPortal(
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
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        className={iconOnly ? 'leave-icon' : className}
        onClick={onClick}
        aria-label={label ?? t('app.leave')}
        title={label ?? t('app.leave')}
      >
        {iconOnly ? <ExitIcon className="h-8 w-8" /> : (label ?? t('app.leave'))}
      </button>
      {modal}
    </>
  )
}
