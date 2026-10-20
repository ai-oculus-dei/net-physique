import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabaseConfigured = Boolean(url && anon)

// La sesión se guarda en el dispositivo: login una sola vez por dispositivo.
export const supabase = createClient(url || 'http://localhost', anon || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'np-auth' },
})

export async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Sin sesión')
  return id
}
