import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Fredoka, Nunito } from 'next/font/google'
import { HideDevChrome } from '@/components/HideDevChrome'
import { getLocale } from '@/lib/session'
import { createTranslator } from '@/i18n'
import './globals.css'

const display = Fredoka({
  subsets: ['latin'],
  variable: '--font-display-family',
})

const sans = Nunito({
  subsets: ['latin'],
  variable: '--font-sans-family',
})

export const metadata: Metadata = {
  title: 'Rich Friends',
  description: 'Una fortuna. Ni una persona honrada.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F0DCB8',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const t = createTranslator(locale)

  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh text-ink antialiased">
        <HideDevChrome />
        <div className="board">
          <a className="sr-only" href="#main">
            {t('app.name')}
          </a>
          {children}
        </div>
      </body>
    </html>
  )
}
