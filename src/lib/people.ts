// Usuarios de la app (id + nombre de pila) para filtros y etiquetas
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Person { id: string; name: string }

let cache: Promise<Person[]> | null = null

export function loadPeople(): Promise<Person[]> {
  cache ??= Promise.resolve(supabase.rpc('app_users')).then(({ data }) => (data ?? []) as Person[]).catch(() => { cache = null; return [] })
  return cache
}

export function usePeople(): Person[] {
  const [people, setPeople] = useState<Person[]>([])
  useEffect(() => { loadPeople().then(setPeople) }, [])
  return people
}
