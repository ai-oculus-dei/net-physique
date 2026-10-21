import { supabase } from './supabase'
import { cardioSetKcal, isCardio, workoutKcal } from './energy'
import type { Body } from './cardio'
import { addDays, weekStart } from './dates'
import { muscleLoad } from './muscles'
import type { Workout, WorkoutSet } from './types'

const SELECT = '*, workout_sets(*, exercise:exercises(*))'

export async function workoutsBetween(from: string, to: string): Promise<Workout[]> {
  const { data, error } = await supabase.from('workouts').select(SELECT).gte('day', from).lte('day', to).order('created_at')
  if (error) throw error
  return ((data ?? []) as Workout[]).map((w) => ({ ...w, workout_sets: [...w.workout_sets].sort((a, b) => a.position - b.position) }))
}

export async function recentWorkouts(limit = 6): Promise<Workout[]> {
  const { data } = await supabase.from('workouts').select(SELECT).eq('planned', false)
    .order('day', { ascending: false }).limit(limit)
  return (data ?? []) as Workout[]
}

export const weekWorkouts =(day: string) => workoutsBetween(weekStart(day), addDays(weekStart(day), 6))

/** Carga semanal solo con series hechas */
export function doneLoad(ws: Workout[], excludeId?: number) {
  return muscleLoad(ws.filter((w) => w.id !== excludeId).flatMap((w) => w.workout_sets.filter((s) => s.done)))
}

export interface WorkoutDraft {
  id?: number
  day: string
  title: string
  intensity: Workout['intensity']
  duration_min: number | null
  notes: string | null
  items: WorkoutSet[]
}

export async function saveWorkout(d: WorkoutDraft, body: Body): Promise<number> {
  const done = d.items.filter((s) => s.done)
  const row = {
    day: d.day, title: d.title || null, intensity: d.intensity, duration_min: d.duration_min, notes: d.notes,
    planned: done.length === 0,
    kcal: Math.round(workoutKcal(done, body, d.intensity, done.length === d.items.length ? d.duration_min : null)),
  }
  let id = d.id
  if (id) {
    const { error } = await supabase.from('workouts').update(row).eq('id', id)
    if (error) throw error
    await supabase.from('workout_sets').delete().eq('workout_id', id)
  } else {
    const { data, error } = await supabase.from('workouts').insert(row).select('id').single()
    if (error) throw error
    id = data.id as number
  }
  if (d.items.length) {
    const { error } = await supabase.from('workout_sets').insert(d.items.map((s, i) => {
      const c = isCardio(s) ? cardioSetKcal(s, body) : null
      return {
        workout_id: id, exercise_id: s.exercise_id, position: i, sets: s.sets, reps: s.reps,
        weight_kg: s.weight_kg, minutes: s.minutes, done: s.done,
        intensity: c ? s.intensity ?? 'moderate' : null,
        distance_km: c ? s.distance_km ?? null : null, avg_watts: c ? s.avg_watts ?? null : null,
        avg_hr: c ? s.avg_hr ?? null : null, machine_kcal: c ? s.machine_kcal ?? null : null,
        kcal: c ? Math.round(c.net) : null, kcal_method: c ? c.method : null,
      }
    }))
    if (error) throw error
  }
  return id!
}

export async function deleteWorkout(id: number) {
  await supabase.from('workouts').delete().eq('id', id)
}

export function draftFrom(w: Workout, asPlanFor?: string): WorkoutDraft {
  return {
    id: asPlanFor ? undefined : w.id,
    day: asPlanFor ?? w.day,
    title: w.title ?? '',
    intensity: w.intensity,
    duration_min: asPlanFor ? null : w.duration_min,
    notes: w.notes,
    items: w.workout_sets.map((s) => ({ ...s, id: undefined, done: asPlanFor ? false : s.done })),
  }
}

export interface CardioWeek {
  minutes: number
  kcal: number
  sessions: number
  byActivity: { name: string; minutes: number; kcal: number; km: number }[]
}

/** Resumen del cardio hecho en la semana (minutos y kcal netas por actividad) */
export function cardioWeek(ws: Workout[]): CardioWeek {
  const by = new Map<string, { name: string; minutes: number; kcal: number; km: number }>()
  let sessions = 0
  for (const w of ws) {
    for (const s of w.workout_sets) {
      if (!s.done || !isCardio(s)) continue
      sessions++
      const a = by.get(s.exercise_id) ?? { name: s.exercise.name, minutes: 0, kcal: 0, km: 0 }
      a.minutes += Number(s.minutes ?? 0)
      a.kcal += Number(s.kcal ?? 0)
      a.km += Number(s.distance_km ?? 0)
      by.set(s.exercise_id, a)
    }
  }
  const byActivity = [...by.values()].sort((a, b) => b.minutes - a.minutes)
  return {
    minutes: byActivity.reduce((a, x) => a + x.minutes, 0),
    kcal: byActivity.reduce((a, x) => a + x.kcal, 0),
    sessions, byActivity,
  }
}
