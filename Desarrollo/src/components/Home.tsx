'use client'

import { useActionState } from 'react'
import { createGameAction, joinGameAction, type FormState } from '@/app/actions'
import { createTranslator, type Locale } from '@/i18n'

const initial: FormState = { error: null }

function CrownMark({ className = 'brand-crown h-6 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 22" className={className} aria-hidden>
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

export function Home({ locale }: { locale: Locale }) {
  const t = createTranslator(locale)
  const [createState, create] = useActionState(createGameAction, initial)
  const [joinState, join] = useActionState(joinGameAction, initial)

  return (
    <main id="main" className="flex min-h-dvh flex-col justify-center px-5 py-14 sm:px-6">
      <div className="flex flex-col items-center">
        <div className="brand-mark">
          <CrownMark />
          <div className="ribbon">{t('app.name')}</div>
        </div>
        <h1 className="mt-5 max-w-sm text-center font-display text-2xl leading-snug text-balance text-ink">
          {t('app.tagline')}
        </h1>
        <p className="mt-3 max-w-xs text-center text-sm leading-relaxed text-muted">{t('home.intro')}</p>
      </div>

      <form action={create} className="sheet mt-10 px-5 py-6">
        <h2 className="font-display text-2xl">{t('home.create')}</h2>
        <p className="mt-1 text-sm text-muted">{t('home.createHint')}</p>
        <label className="mt-5 block text-sm font-semibold text-muted" htmlFor="create-name">
          {t('home.nameLabel')}
        </label>
        <input
          id="create-name"
          name="name"
          required
          minLength={2}
          maxLength={24}
          placeholder={t('home.namePlaceholder')}
          className="mt-2 w-full rounded-xl border-2 border-[#c9a878] bg-[#fffaf0] px-4 py-3 outline-none focus:border-gold"
        />
        {createState.error ? <p className="mt-3 text-sm text-copper">{t(`error.${createState.error}`)}</p> : null}
        <button type="submit" className="btn-upgrade mt-5 w-full px-5 text-sm">
          {t('home.createButton')}
        </button>
      </form>

      <form action={join} className="sheet mt-5 px-5 py-6">
        <h2 className="font-display text-2xl">{t('home.join')}</h2>
        <p className="mt-1 text-sm text-muted">{t('home.joinHint')}</p>
        <label className="mt-5 block text-sm font-semibold text-muted" htmlFor="join-code">
          {t('home.codeLabel')}
        </label>
        <input
          id="join-code"
          name="code"
          required
          autoCapitalize="characters"
          placeholder={t('home.codePlaceholder')}
          className="mt-2 w-full rounded-xl border-2 border-[#c9a878] bg-[#fffaf0] px-4 py-3 uppercase tracking-[0.3em] outline-none focus:border-gold"
        />
        <label className="mt-4 block text-sm font-semibold text-muted" htmlFor="join-name">
          {t('home.nameLabel')}
        </label>
        <input
          id="join-name"
          name="name"
          required
          minLength={2}
          maxLength={24}
          placeholder={t('home.namePlaceholder')}
          className="mt-2 w-full rounded-xl border-2 border-[#c9a878] bg-[#fffaf0] px-4 py-3 outline-none focus:border-gold"
        />
        {joinState.error ? <p className="mt-3 text-sm text-copper">{t(`error.${joinState.error}`)}</p> : null}
        <button type="submit" className="btn-hire mt-5 w-full px-5 text-sm">
          {t('home.joinButton')}
        </button>
      </form>
    </main>
  )
}
