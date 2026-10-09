// Deletes the rows the smoke tests created: dev slug AND source = 'e2e' (hard-coded; production rows can't match).
const DEV_SLUG = 'wives-hangout-2026-dev'

export default async function teardown() {
  process.loadEnvFile('.env.local')
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return
  const headers: Record<string, string> = { apikey: key }
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`
  const res = await fetch(`${url}/rest/v1/registrations?event=eq.${DEV_SLUG}&source=eq.e2e`, { method: 'DELETE', headers })
  if (!res.ok) console.warn(`e2e teardown: delete failed (${res.status})`)
}
