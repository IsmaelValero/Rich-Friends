/**
 * Translation lookup.
 *
 * `t` never throws and never returns a blank: an unknown key falls back to
 * English and then to the key itself, so a half-translated language ships fine.
 */

import { en, type Translations } from './en'
import { es } from './es'

export const LOCALES = ['en', 'es'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'es'

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Castellano',
}

const DICTIONARIES: Record<Locale, Translations> = {
  en: en as unknown as Translations,
  es,
}

export type TranslateParams = Record<string, string | number>

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}

export function translate(locale: Locale, key: string, params?: TranslateParams): string {
  const value = DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? key
  return interpolate(value, params)
}

export interface Translator {
  (key: string, params?: TranslateParams): string
  locale: Locale
}

export function createTranslator(locale: Locale): Translator {
  const t = ((key: string, params?: TranslateParams) => translate(locale, key, params)) as Translator
  t.locale = locale
  return t
}

// --- number formatting -----------------------------------------------------

const CURRENCY_LOCALE: Record<Locale, string> = { en: 'en-GB', es: 'es-ES' }

export function formatMoney(locale: Locale, amount: number, options?: { compact?: boolean }): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[locale], {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    notation: options?.compact ? 'compact' : 'standard',
  }).format(Math.round(amount))
}

/** Gain or loss, always with a sign. */
export function formatSignedMoney(locale: Locale, amount: number): string {
  const rounded = Math.round(amount)
  if (rounded > 0) return `+${formatMoney(locale, rounded)}`
  return formatMoney(locale, rounded)
}

export function formatPrice(locale: Locale, amount: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[locale], {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(locale: Locale, ratio: number, digits = 1): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[locale], {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(ratio)
}

/** Ownership share, without a plus sign. */
export function formatShare(locale: Locale, ratio: number, digits = 0): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[locale], {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio)
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[locale]).format(value)
}

export { en, es }
export type { Translations } from './en'
