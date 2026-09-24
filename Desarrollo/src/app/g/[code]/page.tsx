import { GameApp } from '@/components/GameApp'
import { Lobby } from '@/components/Lobby'
import { loadGamePage } from '@/lib/game-load'
import { createTranslator } from '@/i18n'

export const dynamic = 'force-dynamic'

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const loaded = await loadGamePage(code)

  if (loaded.kind === 'missing') {
    const t = createTranslator(loaded.locale)
    return (
      <main className="flex min-h-dvh flex-col justify-center px-6">
        <h1 className="font-display text-3xl">{t('error.game_not_found')}</h1>
        <a href="/" className="mt-6 text-sm text-forest underline-offset-4 hover:underline">
          {t('common.back')}
        </a>
      </main>
    )
  }

  if (loaded.kind === 'join') {
    const t = createTranslator(loaded.locale)
    return (
      <main className="flex min-h-dvh flex-col justify-center px-6">
        <h1 className="font-display text-3xl">{t('error.game_already_started')}</h1>
        <a href="/" className="mt-6 text-sm text-forest underline-offset-4 hover:underline">
          {t('common.back')}
        </a>
      </main>
    )
  }

  if (loaded.kind === 'lobby') {
    return <Lobby view={loaded.view} locale={loaded.locale} />
  }

  return <GameApp view={loaded.view} locale={loaded.locale} />
}
