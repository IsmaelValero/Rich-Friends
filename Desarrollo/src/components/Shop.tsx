'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import type { ClientAction } from '@/app/actions'
import { canBuyPile, MAX_CARDS_PER_PILE } from '@/engine/cards'
import type { CardPile, ShopCard } from '@/engine/types'
import { formatMoney, type Translator } from '@/i18n'
import type { GameView } from '@/lib/view'

type Act = (action: ClientAction) => Promise<string | null | void>
type HeldCard = ShopCard
type ReceivedCard = ShopCard & { fromName: string }

const TONE = {
  sabotage: { edge: '#c4322a', ink: '#9d241e', wash: '#ffe4df' },
  defense: { edge: '#2a5fd0', ink: '#1d46a8', wash: '#e3edff' },
} as const

export function ShopDesk({ view, t, onAct }: { view: GameView; t: Translator; onAct: Act }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [aim, setAim] = useState<{ cardId: string; toId: string } | null>(null)
  const [arming, setArming] = useState<string | null>(null)
  const others = view.players.filter((player) => !player.isYou)
  const yours = view.you.machines.filter((machine) => machine.owned)
  const you = { hand: view.you.hand, active: view.you.active }
  const defensesFull = view.you.active.length >= MAX_CARDS_PER_PILE
  const canBuySabotage = canBuyPile(you, 'sabotage')
  const canBuyDefense = canBuyPile(you, 'defense')

  async function buy(pile: CardPile) {
    setBusy(pile)
    await onAct({ kind: 'buy_card', pile })
    setBusy(null)
  }

  async function send(cardId: string, toId: string, machineId?: string) {
    setBusy(cardId)
    const error = await onAct({ kind: 'send_card', cardId, toId, machineId })
    setBusy(null)
    if (!error) {
      setSendingId(null)
      setAim(null)
    }
  }

  async function activate(cardId: string, machineId?: string) {
    setBusy(cardId)
    const error = await onAct({ kind: 'activate_card', cardId, machineId })
    setBusy(null)
    if (!error) setArming(null)
  }

  const priceLabel = t('shop.buyFor', { price: formatMoney(t.locale, view.you.cardPrice) })

  return (
    <div className="space-y-4">
      <section className="shop-panel">
        <div className="shop-panel-head">
          <h2 className="shop-panel-title">{t('shop.title')}</h2>
          <p className="shop-panel-hint">{t('shop.limitHint')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Deck
            pile="sabotage"
            label={t('shop.sabotages')}
            buyLabel={canBuySabotage ? priceLabel : t('shop.maxSabotage')}
            busy={busy === 'sabotage'}
            disabled={!canBuySabotage}
            onBuy={() => void buy('sabotage')}
          />
          <Deck
            pile="defense"
            label={t('shop.defenses')}
            buyLabel={canBuyDefense ? priceLabel : t('shop.maxDefense')}
            busy={busy === 'defense'}
            disabled={!canBuyDefense}
            onBuy={() => void buy('defense')}
          />
        </div>
      </section>

      <section className="shop-panel">
        <div className="shop-panel-head">
          <h3 className="shop-panel-title">{t('shop.yours')}</h3>
        </div>
        {view.you.hand.length === 0 && view.you.active.length === 0 ? (
          <p className="text-sm text-muted">{t('shop.emptyHand')}</p>
        ) : null}
        {view.you.hand.length > 0 ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {view.you.hand.map((card) => (
              <Face
                key={card.id}
                card={card}
                t={t}
                footer={
                  card.pile === 'defense' ? (
                    defensesFull ? (
                      <p className="text-center text-sm font-semibold text-muted">{t('shop.maxActive')}</p>
                    ) : card.kind === 'blindaje' && arming === card.id ? (
                      <div>
                        <p className="text-center text-sm font-semibold">{t('shop.whichMachine')}</p>
                        <div className="mt-2 flex flex-wrap justify-center gap-2">
                          {yours.map((machine) => (
                            <button
                              key={machine.id}
                              type="button"
                              disabled={busy === card.id}
                              onClick={() => void activate(card.id, machine.id)}
                              className="rounded-xl border-[3px] border-[#1d46a8] bg-card px-3 py-2 text-xs font-semibold shadow-[0_3px_0_#1d46a8] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                            >
                              {t(`machine.${machine.kind}.name`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === card.id}
                        onClick={() => (card.kind === 'blindaje' ? setArming(card.id) : void activate(card.id))}
                        className="btn-blue w-full px-3 text-sm disabled:opacity-60"
                      >
                        {t('shop.activate')}
                      </button>
                    )
                  ) : sendingId === card.id && aim?.cardId === card.id ? (
                    <div>
                      <p className="text-center text-sm font-semibold">{t('shop.whichMachine')}</p>
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        {(view.players.find((player) => player.id === aim.toId)?.machines ?? [])
                          .filter((machine) => machine.owned)
                          .map((machine) => (
                            <button
                              key={machine.id}
                              type="button"
                              disabled={busy === card.id}
                              onClick={() => void send(card.id, aim.toId, machine.id)}
                              className="rounded-xl border-[3px] border-ink bg-card px-3 py-2 text-xs font-semibold shadow-[0_3px_0_#1c140c] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                            >
                              {t(`machine.${machine.kind}.name`)}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : sendingId === card.id ? (
                    <div>
                      <p className="text-center text-sm font-semibold">{t('shop.who')}</p>
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        {others.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            disabled={busy === card.id}
                            onClick={() =>
                              card.kind === 'saboteador' ? setAim({ cardId: card.id, toId: player.id }) : void send(card.id, player.id)
                            }
                            className="rounded-xl border-[3px] border-ink bg-card px-3 py-2 text-xs font-semibold shadow-[0_3px_0_#1c140c] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                          >
                            {player.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setSendingId(card.id)} className="btn-hire w-full px-3 text-sm">
                      {t('shop.send')}
                    </button>
                  )
                }
              />
            ))}
          </ul>
        ) : null}

        {view.you.active.length > 0 ? (
          <div className={view.you.hand.length > 0 ? 'mt-5' : ''}>
            <h4 className="font-display text-lg uppercase tracking-wide text-muted">{t('shop.active')}</h4>
            <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {view.you.active.map((card) => (
                <Face key={card.id} card={card} t={t} footer={null} />
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {view.you.received.length > 0 ? (
        <section className="shop-panel">
          <div className="shop-panel-head">
            <h3 className="shop-panel-title">{t('shop.received')}</h3>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {view.you.received.map((card) => (
              <Face key={card.id} card={card} t={t} footer={<p className="text-center text-sm">{t('shop.from', { name: card.fromName })}</p>} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Deck({
  pile,
  label,
  buyLabel,
  busy,
  disabled,
  onBuy,
}: {
  pile: CardPile
  label: string
  buyLabel: string
  busy: boolean
  disabled?: boolean
  onBuy: () => void
}) {
  const tone = TONE[pile]
  const art = pile === 'sabotage' ? '/art/cards/card-back-sabotage.png' : '/art/cards/card-back-defense.png'
  return (
    <section>
      <h3 className="font-display text-center text-xl" style={{ color: tone.ink }}>
        {label}
      </h3>
      <div
        className="card-slot relative mx-auto mt-3 overflow-hidden rounded-2xl border-[3px] shadow-[0_7px_0_rgba(40,24,10,0.35)]"
        style={{ borderColor: tone.edge }}
        aria-hidden
      >
        <Image src={art} alt="" fill className="object-cover" sizes="144px" />
      </div>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={onBuy}
        className="btn-buy mx-auto mt-4 block w-full max-w-40 px-3 text-sm disabled:opacity-60"
      >
        {buyLabel}
      </button>
    </section>
  )
}

function Face({
  card,
  t,
  footer,
}: {
  card: HeldCard | ReceivedCard
  t: Translator
  footer: ReactNode | null
}) {
  const tone = TONE[card.pile]
  const art = card.pile === 'sabotage' ? '/art/cards/card-face-sabotage.png' : '/art/cards/card-face-defense.png'
  return (
    <li className="flex flex-col items-center">
      <article
        className="card-slot card-face relative overflow-hidden rounded-2xl border-[3px] shadow-[0_7px_0_rgba(40,24,10,0.28)]"
        style={{ borderColor: tone.edge }}
      >
        <Image src={art} alt="" fill className="object-cover" sizes="144px" priority={false} />
        <div className="card-face-copy">
          <p className="card-face-pile" style={{ color: tone.ink }}>
            {t(card.pile === 'sabotage' ? 'shop.pileSabotage' : 'shop.pileDefense')}
          </p>
          <h4 className="card-face-title">{t(`shop.${card.kind}.name`)}</h4>
          <p className="card-face-blurb">{t(`shop.${card.kind}.blurb`)}</p>
        </div>
      </article>
      {footer ? <div className="mt-3 w-full max-w-36">{footer}</div> : null}
    </li>
  )
}
