import { supabase } from './supabase'
import { MUSCLES } from './muscles'
import { searchExercises } from './exerciseSearch'
import type { Exercise } from './types'

let cache: Exercise[] | null = null

/** Carga todo el catálogo (≈870 ejercicios + personalizados) una vez por sesión */
export async function allExercises(force = false): Promise<Exercise[]> {
  if (cache && !force) return cache
  const out: Exercise[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('exercises').select('*').order('name').range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as Exercise[]))
    if (!data || data.length < 1000) break
  }
  cache = out
  return out
}

export function filterExercises(list: Exercise[], q: string, muscle: string | null, group: string | null) {
  const filtered = list.filter((e) => {
    if (muscle && !e.primary_muscles.includes(muscle) && !e.secondary_muscles.includes(muscle)) return false
    if (group && !e.primary_muscles.some((m) => (MUSCLES as Record<string, { group: string }>)[m]?.group === group)) return false
    return true
  })
  // búsqueda en español, sin tildes, palabra a palabra y con erratas (lib/exerciseSearch)
  return searchExercises(filtered, q)
}

export async function createCustomExercise(e: Pick<Exercise, 'name' | 'primary_muscles' | 'secondary_muscles' | 'equipment' | 'category' | 'instructions'>) {
  const { data: s } = await supabase.auth.getSession()
  const id = 'custom_' + e.name.replace(/\W+/g, '_').slice(0, 40) + '_' + Math.random().toString(36).slice(2, 6)
  const row = { ...e, id, force: null, level: null, mechanic: null, is_custom: true, images: [] as string[], created_by: s.session?.user.id }
  const { error } = await supabase.from('exercises').insert(row)
  if (error) throw error
  cache?.push(row as Exercise)
  return row as Exercise
}
