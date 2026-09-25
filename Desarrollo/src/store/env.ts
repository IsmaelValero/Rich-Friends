/** Supabase↔Vercel integration often injects POSTGRES_URL; we also accept DATABASE_URL. */
export function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!raw) return undefined
  // Pasting in Vercel sometimes wraps the value in quotes.
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '')
  return trimmed || undefined
}
