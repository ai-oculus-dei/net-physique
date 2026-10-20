import { supabase } from './supabase'
import { workoutKcal } from './energy'
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

export async function saveWorkout(d: WorkoutDraft, kg: number): Promise<number> {
  const done = d.items.filter((s) => s.done)
  const row = {
    day: d.day, title: d.title || null, intensity: d.intensity, duration_min: d.duration_min, notes: d.notes,
    planned: done.length === 0,
    kcal: Math.round(workoutKcal(done, kg, d.intensity, done.length === d.items.length ? d.duration_min : null)),
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
    const { error } = await supabase.from('workout_sets').insert(d.items.map((s, i) => ({
      workout_id: id, exercise_id: s.exercise_id, position: i, sets: s.sets, reps: s.reps,
      weight_kg: s.weight_kg, minutes: s.minutes, done: s.done,
    })))
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
