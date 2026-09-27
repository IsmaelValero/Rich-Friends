'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { playAction, leaveGameAction, type ClientAction } from '@/app/actions'
import { Poll } from '@/components/Poll'
import { LeaveControl } from '@/components/LeaveControl'
import { MatchClock } from '@/components/MatchClock'
import { ClockIcon, CoinIcon, CrownIcon, FirmNavIcon, PodiumIcon, ShopNavIcon, TableNavIcon } from '@/components/Icons'
import { formatMoney, createTranslator, type Locale, type Translator } from '@/i18n'
import type { GameView } from '@/lib/view'
import { CompanyDesk } from '@/components/Company'
import { ShopDesk } from '@/components/Shop'
import { LiveMoney } from '@/components/LiveMoney'
import { LiveFirm } from '@/components/LiveFirm'

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

  const rank = Math.max(1, view.players.findIndex((player) => player.isYou) + 1)
  const rankLeading = rank === 1

  if (view.status === 'finished') {
    const standings = view.finalStandings ?? []
    const winner = standings[0]
    return (
      <main id="main" className="flex min-h-dvh flex-col px-5 py-10 sm:px-6">
        <div className="flex justify-center">
          <div className="brand-mark">
            <CrownIcon className="brand-crown h-5 w-8" />
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
          {standings.map((row) => {
            const tone =
              row.position === 1 ? 'is-first' : row.position === 2 ? 'is-second' : row.position === 3 ? 'is-third' : 'is-rest'
            return (
              <li key={row.playerId} className="sheet-soft flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="flex min-w-0 items-center gap-3 text-lg leading-snug">
                  <span className={`place-badge ${tone}`} aria-hidden>
                    {row.position}
                  </span>
                  <span className="font-bold text-ink">{row.name}</span>
                </span>
                <span className="shrink-0 font-display text-xl tabular-nums text-wood">{formatMoney(locale, row.total)}</span>
              </li>
            )
          })}
        </ol>

        <button type="button" className="btn-hire mt-10 w-full px-5 text-sm" onClick={() => void leaveGameAction(view.code)}>
          {t('results.home')}
        </button>
      </main>
    )
  }

  return (
    <div className="game-shell">
      <Poll />
      <header className="game-topbar shrink-0 px-3 pb-2.5 pt-2">
        <div className="game-brand-row">
          <div className="brand-mark">
            <CrownIcon className="brand-crown h-5 w-8" />
            <div className="ribbon">{t('app.name')}</div>
          </div>
          <div className="game-leave-slot">
            <LeaveControl code={view.code} isHost={view.isHost} t={t} iconOnly />
          </div>
        </div>
        <div className="scoreboard" role="group" aria-label={t('dash.board')}>
          <div className="scoreboard-cell">
            <span className="scoreboard-icon" aria-hidden>
              <ClockIcon className="h-8 w-8" />
            </span>
            <div className="scoreboard-copy">
              <span className="scoreboard-label">{t('dash.time')}</span>
              <MatchClock endsAtMs={view.endsAtMs} className="scoreboard-value" />
            </div>
          </div>
          <div className="scoreboard-cell">
            <span className="scoreboard-icon" aria-hidden>
              <CoinIcon className="h-8 w-8" />
            </span>
            <div className="scoreboard-copy">
              <span className="scoreboard-label">{t('dash.cash')}</span>
              <p className="scoreboard-value scoreboard-money">
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
            </div>
          </div>
          <div className={`scoreboard-cell scoreboard-rank ${rankLeading ? 'is-lead' : 'is-chase'}`}>
            <span className="scoreboard-icon scoreboard-icon--podium" aria-hidden>
              <PodiumIcon className="h-9 w-9" />
            </span>
            <div className="scoreboard-copy">
              <span className="scoreboard-label">{t('dash.rank')}</span>
              <p className="scoreboard-value" aria-label={t('company.rank', { position: rank })}>
                {rank}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="game-scroll">
        {tab === 'firm' ? <CompanyDesk view={view} t={t} locale={locale} onAct={act} /> : null}
        {tab === 'shop' ? <ShopDesk view={view} t={t} onAct={act} /> : null}
        {tab === 'table' ? <Standings view={view} t={t} locale={locale} /> : null}
        {error && tab !== 'table' ? <p className="mt-4 text-sm font-semibold text-copper">{t(`error.${error}`)}</p> : null}
      </main>

      <CardStage view={view} t={t} locale={locale} error={error} onAct={act} />

      <nav className="dock fixed bottom-0 left-1/2 z-20 w-full max-w-lg -translate-x-1/2">
        <div className="grid grid-cols-3 items-stretch text-center">
          <NavTab
            label={t('nav.firm')}
            active={tab === 'firm'}
            onClick={() => {
              setError(null)
              setTab('firm')
            }}
            icon="firm"
          />
          <NavTab
            label={t('nav.table')}
            active={tab === 'table'}
            onClick={() => {
              setError(null)
              setTab('table')
            }}
            icon="table"
          />
          <NavTab
            label={t('nav.shop')}
            active={tab === 'shop'}
            onClick={() => {
              setError(null)
              setTab('shop')
            }}
            icon="shop"
          />
        </div>
      </nav>
    </div>
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
  const tone = active ? '#f0b429' : '#b8956a'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nav-tab flex flex-col items-center gap-1 px-2 py-2 ${active ? 'is-active' : ''}`}
    >
      <span className={`nav-tab-icon ${active ? 'is-active' : ''}`}>
        {icon === 'firm' ? <FirmNavIcon color={tone} /> : null}
        {icon === 'table' ? <TableNavIcon color={tone} /> : null}
        {icon === 'shop' ? <ShopNavIcon color={tone} /> : null}
      </span>
      <span className={`font-display text-[0.8rem] leading-none ${active ? 'text-[#f0b429]' : 'text-[#b8956a]'}`}>{label}</span>
      <span className={`nav-tab-line ${active ? 'is-active' : ''}`} aria-hidden />
    </button>
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
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#1c140c]/55 px-5 pb-24 pt-8 sm:items-center sm:pb-8">
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
      <ol className="standings-list mt-4 space-y-3">
        {view.players.map((player, index) => {
          const place = index + 1
          const tone = place === 1 ? 'is-first' : place === 2 ? 'is-second' : place === 3 ? 'is-third' : 'is-rest'
          return (
            <li key={player.id} className={`standings-row ${tone} flex items-center justify-between gap-4 px-4 py-3.5`}>
              <span className="flex min-w-0 items-center gap-3 text-lg leading-snug">
                <span className={`place-badge ${tone}`} aria-hidden>
                  {place}
                </span>
                <span className="min-w-0">
                  <span className="font-bold text-ink">{player.name}</span>
                  {player.isYou ? <span className="font-semibold text-muted"> · {t('common.you')}</span> : null}
                </span>
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
          )
        })}
      </ol>
    </div>
  )
}
