import { getLocale } from '@/lib/session'
import { Home } from '@/components/Home'

export default async function Page() {
  const locale = await getLocale()
  return <Home locale={locale} />
}
