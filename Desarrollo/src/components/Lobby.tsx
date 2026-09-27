'use client'

import { useActionState, useEffect, useState } from 'react'
import Image from 'next/image'
import { joinGameAction, startGameAction, type FormState } from '@/app/actions'
import { Poll } from '@/components/Poll'
import { LeaveControl } from '@/components/LeaveControl'
import { CrownIcon } from '@/components/Icons'
import { DEFENSE_KINDS, SABOTAGE_KINDS } from '@/engine/cards'
import type { CardKind, CardPile } from '@/engine/types'
import { createTranslator, type Locale, type Translator } from '@/i18n'
import type { LobbyView } from '@/lib/view'

const initial: FormState = { error: null }

const HOW_TO_STEPS = ['howTo.step1', 'howTo.step2', 'howTo.step3', 'howTo.step4', 'howTo.step5'] as const

const TONE = {
  sabotage: { edge: '#c4322a', ink: '#9d241e' },
  defense: { edge: '#2a5fd0', ink: '#1d46a8' },
} as const

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

      <div className="game-brand-row">
        <div className="brand-mark">
          <CrownIcon className="brand-crown h-5 w-8" />
          <div className="ribbon">{t('app.name')}</div>
        </div>
        {view.youAreIn ? (
          <div className="game-leave-slot">
            <LeaveControl code={view.code} isHost={view.isHost} t={t} iconOnly />
          </div>
        ) : null}
      </div>

      <h1 className="font-display mt-6 text-center text-3xl">{t('lobby.title')}</h1>
      <p className="mt-2 text-center text-sm text-muted">{t('lobby.share')}</p>
      <p className="mt-1 text-center text-sm font-semibold text-wood">{t('lobby.duration')}</p>

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

        <section className="how-to-block mt-5">
          <h3 className="font-display text-lg uppercase tracking-wide text-ink">{t('howTo.worthTitle')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink">{t('howTo.worthBody')}</p>
        </section>

        <section className="how-to-block mt-5">
          <h3 className="font-display text-lg uppercase tracking-wide text-ink">{t('howTo.cardsTitle')}</h3>

          <h4 className="font-display mt-4 text-base uppercase tracking-wide" style={{ color: TONE.sabotage.ink }}>
            {t('howTo.cardsSabotage')}
          </h4>
          <ul className="how-to-card-grid mt-3">
            {SABOTAGE_KINDS.map((kind) => (
              <HowToCard key={kind} pile="sabotage" kind={kind} t={t} />
            ))}
          </ul>

          <h4 className="font-display mt-5 text-base uppercase tracking-wide" style={{ color: TONE.defense.ink }}>
            {t('howTo.cardsDefense')}
          </h4>
          <ul className="how-to-card-grid mt-3">
            {DEFENSE_KINDS.map((kind) => (
              <HowToCard key={kind} pile="defense" kind={kind} t={t} />
            ))}
          </ul>
        </section>
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

function HowToCard({ pile, kind, t }: { pile: CardPile; kind: CardKind; t: Translator }) {
  const tone = TONE[pile]
  const art = pile === 'sabotage' ? '/art/cards/card-face-sabotage.png' : '/art/cards/card-face-defense.png'
  return (
    <li className="flex flex-col items-center">
      <article
        className="how-to-card relative overflow-hidden rounded-2xl border-[3px] shadow-[0_5px_0_rgba(40,24,10,0.28)]"
        style={{ borderColor: tone.edge }}
      >
        <Image src={art} alt="" fill className="object-cover" sizes="120px" />
        <div className="card-face-copy how-to-card-copy">
          <p className="card-face-pile" style={{ color: tone.ink }}>
            {t(pile === 'sabotage' ? 'shop.pileSabotage' : 'shop.pileDefense')}
          </p>
          <h5 className="card-face-title how-to-card-title">{t(`shop.${kind}.name`)}</h5>
          <p className="card-face-blurb how-to-card-blurb">{t(`shop.${kind}.blurb`)}</p>
        </div>
      </article>
    </li>
  )
}
