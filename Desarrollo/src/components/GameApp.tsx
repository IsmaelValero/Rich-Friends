'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { playAction, leaveGameAction, type ClientAction } from '@/app/actions'
import { Poll } from '@/components/Poll'
import { LeaveControl } from '@/components/LeaveControl'
import { formatMoney, createTranslator, type Locale, type Translator } from '@/i18n'
import type { GameView } from '@/lib/view'
import { CompanyDesk } from '@/components/Company'
import { ShopDesk } from '@/components/Shop'
import { LiveMoney } from '@/components/LiveMoney'
import { LiveFirm } from '@/components/LiveFirm'
import { LiveRate } from '@/components/LiveRate'

type Tab = 'firm' | 'shop' | 'table'

export function GameApp({ view, locale }: { view: GameView; locale: Locale }) {
  const t = createTranslator(locale)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('firm')
  const [error, setError] = useState<string | null>(null)

  async function act(action: ClientAction) {
    const result = await playAction(view.code, action)
    setError(result.error)
    if (!result.error) router.refresh()
    return result.error
  }

  if (view.status === 'finished') {
    const standings = view.finalStandings ?? []
    const winner = standings[0]
    return (
      <main id="main" className="flex min-h-dvh flex-col px-5 py-10 sm:px-6">
        <div className="flex justify-center">
          <div className="brand-mark">
            <CrownMark />
            <div className="ribbon">{t('app.name')}</div>
          </div>
        </div>

        <p className="mt-6 text-center text-[0.7rem] font-extrabold tracking-[0.22em] text-muted uppercase">
          {t('results.title')}
        </p>
        <h1 className="font-display mt-3 text-center text-3xl leading-tight text-balance text-ink sm:text-4xl">
          {t('results.winner', { name: winner?.name ?? '' })}
        </h1>
        <p className="mt-2 text-center text-sm text-muted">{t('results.blurb')}</p>

        {winner ? (
          <section className="sheet mt-8 px-5 py-5 text-center">
            <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-muted uppercase">{t('results.first')}</p>
            <p className="font-display mt-2 text-3xl text-wood">{winner.name}</p>
            <p className="font-display mt-2 text-2xl tabular-nums text-ink">{formatMoney(locale, winner.total)}</p>
          </section>
        ) : null}

        <ol className="mt-5 space-y-3">
          {standings.map((row) => (
            <li key={row.playerId} className="sheet-soft flex items-center justify-between gap-4 px-4 py-3.5">
              <span className="min-w-0 text-lg leading-snug">
                <span className="font-semibold text-muted">{t('results.position', { position: row.position })}</span>{' '}
                <span className="font-bold text-ink">{row.name}</span>
              </span>
              <span className="shrink-0 font-display text-xl tabular-nums text-wood">{formatMoney(locale, row.total)}</span>
            </li>
          ))}
        </ol>

        <button type="button" className="btn-hire mt-10 w-full px-5 text-sm" onClick={() => void leaveGameAction(view.code)}>
          {t('results.home')}
        </button>
      </main>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col pb-28">
      <Poll />
      <header className="sticky top-0 z-20 border-b border-[#d4b896]/80 bg-[#f0dcb8]/96 px-4 pb-3 pt-3 backdrop-blur-md">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <span aria-hidden />
          <div className="brand-mark">
            <CrownMark />
            <div className="ribbon">{t('app.name')}</div>
          </div>
          <div className="flex justify-end self-center">
            <LeaveControl code={view.code} isHost={view.isHost} t={t} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <section className="sheet-soft px-3 py-3">
            <p className="text-[0.65rem] font-extrabold tracking-[0.14em] text-muted uppercase">{t('dash.netWorth')}</p>
            <p className="font-display mt-1 text-xl tabular-nums leading-none">
              <LiveFirm
                machines={view.you.machines}
                effects={view.you.effects}
                initial={view.you.companyValue}
                mask
                locale={locale}
              />
            </p>
          </section>
          <section className="sheet-soft px-3 py-3">
            <p className="text-[0.65rem] font-extrabold tracking-[0.14em] text-muted uppercase">{t('dash.cash')}</p>
            <p className="font-display mt-1 flex items-center gap-1.5 text-xl tabular-nums leading-none">
              <CoinMark />
              <LiveMoney
                settled={view.you.settledCash}
                machines={view.you.machines}
                effects={view.you.effects}
                siphons={view.you.siphons}
                mask
                running={view.status === 'running'}
                initial={view.you.cash}
                locale={locale}
              />
            </p>
            <p className="mt-1.5">
              <LiveRate machines={view.you.machines} effects={view.you.effects} mask locale={locale} className="rate-pill" />
            </p>
          </section>
        </div>
      </header>

      <main id="main" className="min-h-0 flex-1 px-4 py-4">
        {tab === 'firm' ? <CompanyDesk view={view} t={t} locale={locale} onAct={act} /> : null}
        {tab === 'shop' ? <ShopDesk view={view} t={t} onAct={act} /> : null}
        {tab === 'table' ? <Standings view={view} t={t} locale={locale} /> : null}
        {error ? <p className="mt-4 text-sm font-semibold text-copper">{t(`error.${error}`)}</p> : null}
      </main>

      <CardStage view={view} t={t} locale={locale} error={error} onAct={act} />

      <nav className="dock fixed bottom-0 left-1/2 z-20 w-full max-w-lg -translate-x-1/2">
        <div className="grid grid-cols-3 items-stretch text-center">
          <NavTab label={t('nav.firm')} active={tab === 'firm'} onClick={() => setTab('firm')} icon="firm" />
          <NavTab label={t('nav.table')} active={tab === 'table'} onClick={() => setTab('table')} icon="table" />
          <NavTab label={t('nav.shop')} active={tab === 'shop'} onClick={() => setTab('shop')} icon="shop" />
        </div>
      </nav>
    </div>
  )
}

function CoinMark() {
  return (
    <Image
      src="/art/ui/coin.png"
      alt=""
      width={22}
      height={22}
      className="h-5 w-5 shrink-0 rounded-full object-cover"
      aria-hidden
    />
  )
}

function CrownMark() {
  return (
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
  )
}

function NavTab({
  label,
  active,
  onClick,
  icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon: 'firm' | 'table' | 'shop'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nav-tab flex flex-col items-center gap-1.5 px-2 py-3 ${active ? 'is-active' : ''}`}
    >
      <span className={`nav-tab-icon ${active ? 'is-active' : ''}`}>
        <NavIcon kind={icon} active={active} />
      </span>
      <span className={`font-display text-sm leading-none ${active ? 'text-[#f0b429]' : 'text-[#b8956a]'}`}>{label}</span>
      <span className={`nav-tab-line ${active ? 'is-active' : ''}`} aria-hidden />
    </button>
  )
}

function NavIcon({ kind, active }: { kind: 'firm' | 'table' | 'shop'; active: boolean }) {
  const tone = active ? '#f0b429' : '#b8956a'
  if (kind === 'firm') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <path
          fill={tone}
          d="M4.2 17.2 5.6 9.4l3.1 3.2L12 5.8l3.3 6.8 3.1-3.2 1.4 7.8H4.2Zm.5 1.5h14.6c.4 0 .7.3.7.7v.4c0 .2-.2.4-.4.4H4.4c-.2 0-.4-.2-.4-.4v-.4c0-.4.3-.7.7-.7Z"
        />
      </svg>
    )
  }
  if (kind === 'table') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
        <path
          d="M8.2 4.5h7.6v4.2c0 2.1-1.7 3.8-3.8 3.8h0c-2.1 0-3.8-1.7-3.8-3.8V4.5Z"
          stroke={tone}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M8.2 6.2H5.4c-.7 0-1.2.7-.9 1.3.5 1.1 1.6 1.8 2.8 1.8" stroke={tone} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15.8 6.2h2.8c.7 0 1.2.7.9 1.3-.5 1.1-1.6 1.8-2.8 1.8" stroke={tone} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10.2 16.2h3.6v1.6h-3.6zM9.2 17.8h5.6v1.5H9.2z" stroke={tone} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
      <rect x="4.5" y="5.5" width="10" height="13.5" rx="1.6" stroke={tone} strokeWidth="1.8" />
      <rect x="9.5" y="3.5" width="10" height="13.5" rx="1.6" stroke={tone} strokeWidth="1.8" />
      <path
        d="M14.5 8.2 15.1 9.6l1.5.2-1.1 1 .3 1.5-1.3-.8-1.3.8.3-1.5-1.1-1 1.5-.2z"
        fill={tone}
      />
    </svg>
  )
}

function CardStage({
  view,
  t,
  locale,
  error,
  onAct,
}: {
  view: GameView
  t: Translator
  locale: Locale
  error: string | null
  onAct: (action: ClientAction) => Promise<string | null | void>
}) {
  const card = view.you.incoming[0]
  const note = view.you.notices[0]
  const canBlock = view.you.active.some((entry) => entry.kind === 'escudo' || entry.kind === 'contraataque' || entry.kind === 'blindaje')
  if (!card && !note) return null
  const sabotage = card?.pile === 'sabotage'
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#1c140c]/55 px-5 pb-28 pt-8 sm:items-center sm:pb-8">
      <section
        className="sheet w-full max-w-sm px-5 py-5"
        style={{
          borderColor: card ? (sabotage ? '#c4322a' : '#2a5fd0') : undefined,
        }}
      >
        {card ? (
          <>
            <p className="text-sm font-semibold">{t('shop.sentYou', { name: card.fromName })}</p>
            <h2 className="font-display mt-2 text-3xl leading-none">{t(`shop.${card.kind}.name`)}</h2>
            <p className="mt-3 text-sm leading-snug">{t(`shop.${card.kind}.blurb`)}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => void onAct({ kind: 'close_card', cardId: card.id, block: false })} className="btn-hire px-5 text-sm">
                {t('shop.close')}
              </button>
              {canBlock ? (
                <button
                  type="button"
                  onClick={() => void onAct({ kind: 'close_card', cardId: card.id, block: true })}
                  className="btn-blue px-5 text-sm"
                >
                  {t('shop.blockCard')}
                </button>
              ) : null}
            </div>
            {error ? <p className="mt-3 text-sm text-copper">{t(`error.${error}`)}</p> : null}
          </>
        ) : note ? (
          <>
            <p className="font-display text-2xl leading-tight">
              {t(`notice.${note.code}`, {
                name: note.name,
                card: note.card ? t(`shop.${note.card}.name`) : '',
                amount: note.amount != null ? formatMoney(locale, note.amount) : '',
              })}
            </p>
            <button
              type="button"
              onClick={() => void onAct({ kind: 'dismiss_card_notice', noticeId: note.id })}
              className="btn-hire mt-5 px-5 text-sm"
            >
              {t('shop.close')}
            </button>
          </>
        ) : null}
      </section>
    </div>
  )
}

function Standings({ view, t, locale }: { view: GameView; t: Translator; locale: Locale }) {
  return (
    <div>
      <h2 className="font-display text-3xl text-ink">{t('nav.table')}</h2>
      <ol className="mt-4 space-y-3">
        {view.players.map((player, index) => (
          <li key={player.id} className="sheet flex items-center justify-between gap-4 px-4 py-3.5">
            <span className="min-w-0 text-lg leading-snug">
              <span className="font-semibold text-muted">{index + 1}.</span>{' '}
              <span className="font-bold text-ink">{player.name}</span>
              {player.isYou ? <span className="font-semibold text-muted"> · {t('common.you')}</span> : null}
            </span>
            <span className="shrink-0 font-display text-2xl tabular-nums leading-none text-wood">
              <LiveFirm
                machines={player.machines}
                effects={player.effects}
                initial={player.companyValue}
                mask={player.isYou}
                locale={locale}
              />
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
