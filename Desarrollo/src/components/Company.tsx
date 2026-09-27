'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { machineLook, rateParts, rumorActive } from '@/engine/effects'
import { canBuyMachine, MACHINE_LIST, MACHINE_SPEC, MAX_UPGRADES, MAX_WORKERS, upgradePrice, workerPrice } from '@/engine/machines'
import type { ClientAction } from '@/app/actions'
import { CrownIcon, CoinIcon, LockIcon, UpgradeIcon, WorkerIcon } from '@/components/Icons'
import { formatMoney, type Locale, type Translator } from '@/i18n'
import type { Machine, MachineKind } from '@/engine/types'
import type { GameView } from '@/lib/view'

type Act = (action: ClientAction) => Promise<string | null | void>
type Boost = { workers: number; upgrades: number }

export function CompanyDesk({
  view,
  t,
  locale,
  onAct,
}: {
  view: GameView
  t: Translator
  locale: Locale
  onAct: Act
}) {
  const [boost, setBoost] = useState<Record<string, Boost>>({})
  const boostRef = useRef(boost)
  const [busy, setBusy] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  function shown(machine: Machine): Machine {
    const extra = boost[machine.id]
    const workers = Math.max(Math.max(0, machine.workers), extra?.workers ?? 0)
    const upgrades = Math.max(Math.max(0, machine.upgrades), extra?.upgrades ?? 0)
    return { ...machine, workers, upgrades }
  }

  async function press(machine: Machine, kind: 'upgrade_machine' | 'buy_worker') {
    const extra = boostRef.current[machine.id]
    const workers = Math.max(Math.max(0, machine.workers), extra?.workers ?? 0)
    const upgrades = Math.max(Math.max(0, machine.upgrades), extra?.upgrades ?? 0)
    const next: Boost = {
      workers: kind === 'buy_worker' ? workers + 1 : workers,
      upgrades: kind === 'upgrade_machine' ? upgrades + 1 : upgrades,
    }
    const merged = { ...boostRef.current, [machine.id]: next }
    boostRef.current = merged
    setBoost(merged)
    setBusy(`${kind}:${machine.id}`)
    const error = await onAct({ kind, machineId: machine.id })
    setBusy((current) => (current === `${kind}:${machine.id}` ? null : current))
    if (error) {
      const reverted = { ...boostRef.current }
      delete reverted[machine.id]
      boostRef.current = reverted
      setBoost(reverted)
    }
  }

  const playMachines = MACHINE_LIST
  const ownedCount = view.you.machines.filter((machine) => machine.owned).length
  const sorted = [...view.you.machines].sort(
    (a, b) => MACHINE_LIST.findIndex((spec) => spec.kind === a.kind) - MACHINE_LIST.findIndex((spec) => spec.kind === b.kind),
  )

  let firmRate = 0
  for (const machine of view.you.machines) {
    if (!machine.owned) continue
    const parts = rateParts(shown(machine), view.you.effects, nowMs, view.you.machines)
    firmRate += (parts.owner ?? 0) + (parts.thief ?? 0)
  }

  return (
    <div>
      {view.you.cola ? <p className="sheet mb-3 px-4 py-3 text-sm font-semibold">{t('machine.cola')}</p> : null}
      {view.you.pending ? <p className="sheet mb-3 px-4 py-3 text-sm font-semibold">{t('machine.pending')}</p> : null}

      <section className="firm-section">
        <div className="firm-section-head">
          <h2 className="firm-section-title">
            <span className="firm-section-crown" aria-hidden>
              <CrownIcon className="h-4 w-5" />
            </span>
            {t('company.machines')}
          </h2>
          <p className="firm-section-progress">{t('machine.progress', { owned: ownedCount, total: playMachines.length })}</p>
        </div>

        <ul className="firm-machine-list">
          {sorted.map((source) => {
            const machine = shown(source)
            const spec = MACHINE_SPEC[machine.kind]
            const unlocked = canBuyMachine(view.you.machines, machine.kind)
            const previousIndex = MACHINE_LIST.findIndex((entry) => entry.kind === machine.kind)
            const previous = previousIndex > 0 ? MACHINE_LIST[previousIndex - 1] : null
            const money = (amount: number) => formatMoney(locale, amount)
            const look = machine.owned ? machineLook(machine.id, view.you.effects, nowMs) : null
            const hidden = rumorActive(view.you.effects, nowMs)
            const parts = machine.owned ? rateParts(machine, view.you.effects, nowMs, view.you.machines) : null
            const rate = machine.owned ? Math.round((parts?.owner ?? 0) + (parts?.thief ?? 0)) : spec.perSecond
            const stopped = look?.tone === 'stopped'
            const stolen = look?.tone === 'stolen'
            const share = machine.owned && firmRate > 0 ? Math.round((rate / firmRate) * 100) : 0
            const rateLabel = hidden
              ? t('machine.hidden')
              : t('machine.rateUp', { rate: money(rate).replace(/\s?€$/, '') })
            const workerLabel = t(
              (machine.owned ? machine.workers : 0) === 1 ? 'machine.worker' : 'machine.workers',
            ).toLowerCase()

            if (!machine.owned) {
              return (
                <li key={machine.id} className={`machine-row ${unlocked ? '' : 'machine-row--locked'}`}>
                  <MachineLogo kind={machine.kind} color={spec.color} compact locked={!unlocked} />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-display truncate text-lg leading-none">{t(`machine.${machine.kind}.name`)}</h4>
                    <p className="mt-1.5">
                      <span className={`rate-pill ${unlocked ? '' : 'is-muted'}`}>
                        <span aria-hidden>▲</span>{' '}
                        {t('machine.rateUp', { rate: money(spec.perSecond).replace(/\s?€$/, '') })}
                      </span>
                    </p>
                  </div>
                  {unlocked ? (
                    <button
                      type="button"
                      onClick={() => void onAct({ kind: 'buy_machine', machineId: machine.id })}
                      className="btn-buy machine-action-btn shrink-0"
                      aria-label={t('machine.buyFor', { price: money(spec.value) })}
                      title={t('machine.buyFor', { price: money(spec.value) })}
                    >
                      <CoinIcon className="machine-action-icon" />
                      <span>{money(spec.value)}</span>
                    </button>
                  ) : (
                    <span
                      className="machine-row-lock shrink-0"
                      title={t('machine.needPrevious', { name: previous ? t(`machine.${previous.kind}.name`) : '' })}
                    >
                      <LockIcon className="h-6 w-6" />
                    </span>
                  )}
                </li>
              )
            }

            return (
              <li
                key={machine.id}
                className={`machine-card machine-card--owned ${stolen ? 'is-stolen' : ''} ${stopped ? 'is-stopped' : ''}`}
                style={{ borderColor: stolen ? '#c4322a' : stopped ? '#8a8178' : undefined }}
              >
                <div className="machine-card-body">
                  <MachineLogo kind={machine.kind} color={stolen ? '#c4322a' : spec.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-display text-xl leading-none">{t(`machine.${machine.kind}.name`)}</h4>
                      <span className="level-pill shrink-0">{t('machine.level', { level: machine.upgrades })}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-muted">
                      {t('machine.stats', { percent: share, workers: machine.workers, workerLabel })}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rate-pill ${stolen ? 'is-bad' : ''}`}>
                        <span aria-hidden>▲</span> {rateLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-snug text-muted italic">{t(`machine.${machine.kind}.blurb`)}</p>
                    {stolen ? (
                      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[#c4322a]">
                        <AlertMark />
                        <span>{t('machine.workingFor', { name: look.by })}</span>
                      </p>
                    ) : null}
                    {look?.tone === 'slow' ? <p className="mt-2 text-sm font-semibold">{t('machine.half')}</p> : null}
                    {look?.tone === 'interest' ? (
                      <p className="mt-2 text-sm font-semibold">{t('machine.interestCut', { name: look.by })}</p>
                    ) : null}
                    {stopped ? <p className="mt-2 text-sm font-semibold">{t('machine.stoppedBy', { name: look.by })}</p> : null}
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  <MachineButton
                    tone="upgrade"
                    busy={busy === `upgrade_machine:${machine.id}`}
                    disabled={machine.upgrades >= MAX_UPGRADES || stopped}
                    label={
                      machine.upgrades >= MAX_UPGRADES
                        ? t('machine.maxed')
                        : t('machine.upgradeFor', { price: money(upgradePrice(machine)) })
                    }
                    onClick={() => void press(source, 'upgrade_machine')}
                  >
                    {machine.upgrades >= MAX_UPGRADES ? (
                      t('machine.maxed')
                    ) : (
                      <>
                        <UpgradeIcon className="machine-action-icon" tone="inherit" />
                        <span>{money(upgradePrice(machine))}</span>
                      </>
                    )}
                  </MachineButton>
                  <MachineButton
                    tone="hire"
                    busy={busy === `buy_worker:${machine.id}`}
                    disabled={machine.workers >= MAX_WORKERS || stopped}
                    label={
                      machine.workers >= MAX_WORKERS
                        ? t('machine.maxed')
                        : t('machine.workerFor', { price: money(workerPrice(machine)) })
                    }
                    onClick={() => void press(source, 'buy_worker')}
                  >
                    {machine.workers >= MAX_WORKERS ? (
                      t('machine.maxed')
                    ) : (
                      <>
                        <WorkerIcon className="machine-action-icon" tone="inherit" />
                        <span>{money(workerPrice(machine))}</span>
                      </>
                    )}
                  </MachineButton>
                </div>

                {stopped && look.effectId && look.amount ? (
                  <button
                    type="button"
                    onClick={() => void onAct({ kind: 'pay_restart', effectId: look.effectId! })}
                    className="btn-hire relative z-10 mt-3 w-full px-4 text-sm"
                    style={{ filter: 'grayscale(0)' }}
                  >
                    {t('machine.payRestart', { amount: money(look.amount) })}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function AlertMark() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#c4322a] text-xs font-black text-white" aria-hidden>
      !
    </span>
  )
}

function MachineLogo({
  kind,
  color,
  locked = false,
  compact = false,
}: {
  kind: MachineKind
  color: string
  locked?: boolean
  compact?: boolean
}) {
  const size = compact ? 52 : 72
  const rim = locked ? undefined : `color-mix(in srgb, ${color} 35%, #3a2410 65%)`
  return (
    <span
      className={`machine-logo shrink-0 ${locked ? 'machine-logo--locked' : ''}`}
      style={{
        width: size,
        height: size,
        borderColor: rim,
        boxShadow: locked
          ? undefined
          : `inset 0 0 0 2px color-mix(in srgb, ${color} 55%, #fff8e0), inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 0 color-mix(in srgb, ${color} 25%, #3a2410), 0 6px 12px rgba(70,40,15,0.14)`,
      }}
      aria-hidden
    >
      <Image
        src={`/art/machines/${kind}.png`}
        alt=""
        width={size}
        height={size}
        className={`h-full w-full object-cover ${locked ? 'opacity-60 grayscale' : ''}`}
      />
    </span>
  )
}

function MachineButton({
  tone,
  busy,
  disabled,
  label,
  onClick,
  children,
}: {
  tone: 'upgrade' | 'hire'
  busy: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-label={label}
      title={label}
      className={`${tone === 'upgrade' ? 'btn-upgrade' : 'btn-hire'} machine-action-btn disabled:opacity-60`}
    >
      {children}
    </button>
  )
}
