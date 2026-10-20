import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

type Theme = 'dark' | 'light'

function storedTheme(): Theme {
  try { return (localStorage.getItem('np-theme') as Theme) || 'dark' } catch { return 'dark' }
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#05070d' : '#f4f6fb')
  try { localStorage.setItem('np-theme', t) } catch { /* sin storage */ }
}

interface AppState {
  session: Session | null
  ready: boolean
  profile: Profile | null
  theme: Theme
  setSession: (s: Session | null) => void
  loadProfile: () => Promise<void>
  saveProfile: (patch: Partial<Profile>) => Promise<string | null>
  setTheme: (t: Theme) => void
}

export const useApp = create<AppState>((set, get) => ({
  session: null,
  ready: false,
  profile: null,
  theme: storedTheme(),
  setSession: (session) => set({ session, ready: true }),
  loadProfile: async () => {
    const id = get().session?.user.id
    if (!id) return set({ profile: null })
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    const profile = (data as Profile) ?? null
    set({ profile })
    if (profile?.theme) get().setTheme(profile.theme)
  },
  saveProfile: async (patch) => {
    const id = get().session?.user.id
    if (!id) return 'Sin sesión'
    const { data, error } = await supabase.from('profiles')
      .upsert({ id, ...patch, updated_at: new Date().toISOString() }).select().single()
    if (error) return error.message
    set({ profile: data as Profile })
    return null
  },
  setTheme: (theme) => { applyTheme(theme); set({ theme }) },
}))
