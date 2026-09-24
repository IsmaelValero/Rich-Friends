/**
 * Identity without accounts.
 *
 * A player is a random token in an http-only cookie, scoped per game. It is not
 * security in any serious sense, but it means a cousin cannot read another
 * player's secrets out of the page source, which is the only property that
 * matters here. Real accounts can arrive later without changing the engine.
 */

import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n'

const TOKEN_PREFIX = 'rf_player_'
const HOST_PREFIX = 'rf_host_'
const LOCALE_COOKIE = 'rf_locale'
const YEAR = 60 * 60 * 24 * 365

export function createToken(): string {
  return randomBytes(24).toString('base64url')
}

/** Four unambiguous characters: no O/0 or I/1 to mistype over the phone. */
export function createGameCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(4)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

function tokenCookieName(code: string): string {
  return `${TOKEN_PREFIX}${code.toUpperCase()}`
}

function hostCookieName(code: string): string {
  return `${HOST_PREFIX}${code.toUpperCase()}`
}

export async function getPlayerToken(code: string): Promise<string | null> {
  const store = await cookies()
  return store.get(tokenCookieName(code))?.value ?? null
}

export async function setPlayerToken(code: string, token: string): Promise<void> {
  const store = await cookies()
  store.set(tokenCookieName(code), token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: YEAR,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function clearPlayerToken(code: string): Promise<void> {
  const store = await cookies()
  store.delete(tokenCookieName(code))
}

export async function getHostToken(code: string): Promise<string | null> {
  const store = await cookies()
  return store.get(hostCookieName(code))?.value ?? null
}

export async function setHostToken(code: string, token: string): Promise<void> {
  const store = await cookies()
  store.set(hostCookieName(code), token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: YEAR,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export async function setLocale(locale: Locale): Promise<void> {
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, { sameSite: 'lax', path: '/', maxAge: YEAR })
}
