'use client'

import { useActionState, useEffect, useState } from 'react'
import { joinGameAction, startGameAction, type FormState } from '@/app/actions'
import { Poll } from '@/components/Poll'
import { LeaveControl } from '@/components/LeaveControl'
import { createTranslator, type Locale } from '@/i18n'
import type { LobbyView } from '@/lib/view'

const initial: FormState = { error: null }

const HOW_TO_STEPS = ['howTo.step1', 'howTo.step2', 'howTo.step3', 'howTo.step4', 'howTo.step5'] as const

export function Lobby({ view, locale }: { view: LobbyView; locale: Locale }) {
  const t = createTranslator(locale)
  const [joinState, join] = useActionState(joinGameAction, initial)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const invite = t('lobby.inviteText', { url: origin, code: view.code })

  async function start() {
    const result = await startGameAction(view.code)
    if (result.error) setError(result.error)
  }

  return (
    <main id="main" className="min-h-dvh px-5 py-10 sm:px-6">
      <Poll />

      <div className="flex justify-center">
        <div className="brand-mark">
          <svg viewBox="0 0 32 22" className="brand-crown h-5 w-8" aria-hidden>
            <path
              d="M3 17 L6 6 L12 12 L16 3 L20 12 L26 6 L29 17 Z"
              fill="#f0b429"
              stroke="#8a5a18"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <rect x="4" y="17" width="24" height="3.5" rx="1" fill="#f0b429" stroke="#8a5a18" strokeWidth="1.2" />
            <circle cx="6" cy="6" r="1.35" fill="#fff1b8" stroke="#8a5a18" strokeWidth="0.8" />
            <circle cx="16" cy="3" r="1.45" fill="#fff1b8" stroke="#8a5a18" strokeWidth="0.8" />
            <circle cx="26" cy="6" r="1.35" fill="#fff1b8" stroke="#8a5a18" strokeWidth="0.8" />
          </svg>
          <div className="ribbon">{t('app.name')}</div>
        </div>
      </div>

      <h1 className="font-display mt-6 text-center text-3xl">{t('lobby.title')}</h1>
      <p className="mt-2 text-center text-sm text-muted">{t('lobby.share')}</p>

      {view.youAreIn ? (
        <div className="mt-4 flex justify-center">
          <LeaveControl code={view.code} isHost={view.isHost} t={t} />
        </div>
      ) : null}

      <div className="sheet mt-6 px-5 py-6 text-center">
        <p className="text-[0.65rem] font-extrabold tracking-[0.2em] text-muted uppercase">{t('lobby.codeLabel')}</p>
        <p className="font-display mt-2 text-5xl tracking-[0.18em] text-gold">{view.code}</p>
        <a
          className="mt-5 inline-block text-sm font-bold text-forest underline-offset-4 hover:underline"
          href={`https://wa.me/?text=${encodeURIComponent(invite)}`}
          target="_blank"
          rel="noreferrer"
        >
          {t('lobby.whatsapp')}
        </a>
      </div>

      <section className="sheet mt-5 px-5 py-5">
        <h2 className="font-display text-xl">
          {t('lobby.players', { count: view.players.length, max: view.maxPlayers })}
        </h2>
        <ul className="mt-3 divide-y divide-[#d4b896]/80">
          {view.players.map((player) => (
            <li key={player.id} className="flex items-center justify-between py-3">
              <span className="font-bold text-ink">
                {player.name}
                {player.isYou ? <span className="font-semibold text-muted"> · {t('common.you')}</span> : null}
              </span>
              {player.isHost ? (
                <span className="rounded-lg border border-[#c9a878] bg-[#fff8ea] px-2 py-0.5 text-[0.65rem] font-extrabold tracking-wide text-wood uppercase">
                  {t('nav.host')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <details className="sheet fold mt-5 px-5 py-4">
        <summary className="font-display text-xl leading-none">{t('howTo.title')}</summary>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t('howTo.intro')}</p>
        <ol className="mt-4 space-y-3">
          {HOW_TO_STEPS.map((key, index) => (
            <li key={key} className="flex gap-3 text-sm leading-snug text-ink">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#efe0c4] text-xs font-extrabold text-wood">
                {index + 1}
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
      </details>

      {!view.youAreIn ? (
        <form action={join} className="sheet mt-5 px-5 py-5">
          <input type="hidden" name="code" value={view.code} />
          <label className="block text-sm font-semibold text-muted" htmlFor="lobby-name">
            {t('home.nameLabel')}
          </label>
          <input
            id="lobby-name"
            name="name"
            required
            minLength={2}
            className="mt-2 w-full rounded-xl border-2 border-[#c9a878] bg-[#fffaf0] px-4 py-3 outline-none focus:border-gold"
          />
          {joinState.error ? <p className="mt-3 text-sm text-copper">{t(`error.${joinState.error}`)}</p> : null}
          <button type="submit" className="btn-upgrade mt-4 w-full px-5 text-sm">
            {t('home.joinButton')}
          </button>
        </form>
      ) : null}

      {view.youAreIn && view.players.length < view.minPlayers ? (
        <p className="sheet mt-5 px-4 py-3 text-center text-sm font-semibold text-muted">{t('lobby.needMore')}</p>
      ) : null}

      {view.isHost && view.players.length >= view.minPlayers ? (
        <button type="button" onClick={() => void start()} className="btn-upgrade mt-6 w-full px-5 text-sm">
          {t('lobby.start')}
        </button>
      ) : view.youAreIn && !view.isHost && view.players.length >= view.minPlayers ? (
        <p className="mt-6 text-center text-sm font-semibold text-muted">{t('lobby.hostOnly')}</p>
      ) : null}

      {error ? <p className="mt-4 text-center text-sm text-copper">{t(`error.${error}`)}</p> : null}
    </main>
  )
}
