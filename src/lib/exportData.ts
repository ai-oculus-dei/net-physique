// Carga de datos para la exportación (solo del usuario, por RLS)
import { supabase } from './supabase'
import { computeDayEnergy } from './energy'
import { hhmm } from './dates'
import type { ExportInput, ExportOptions } from './exportCsv'
import type { Profile } from './types'

export async function loadExportInput(profile: Profile, from: string, to: string, o: Pick<ExportOptions, 'diet' | 'training'>): Promise<ExportInput> {
  const empty = { data: [] as any[] }
  const [food, targets, weights, workouts, steps] = await Promise.all([
    o.diet ? supabase.from('food_logs').select('day,eaten_at,meal,name,grams,kcal,protein,carbs,fat')
      .gte('day', from).lte('day', to).order('day').order('eaten_at') : empty,
    o.diet ? supabase.from('daily_energy').select('day,target_kcal').gte('day', from).lte('day', to) : empty,
    o.diet ? supabase.from('weights').select('day,kg').gte('day', from).lte('day', to) : empty,
    o.training ? supabase.from('workouts').select('day,title,created_at,workout_sets(position,sets,reps,weight_kg,minutes,done,distance_km,avg_watts,avg_hr,kcal,kcal_method,exercise:exercises(name,category,primary_muscles,secondary_muscles))')
      .eq('planned', false).gte('day', from).lte('day', to).order('day').order('created_at') : empty,
    o.training ? supabase.from('steps').select('day,steps').gte('day', from).lte('day', to) : empty,
  ])

  const foods = (food.data ?? []).map((f: any) => ({
    day: f.day, time: hhmm(f.eaten_at), meal: f.meal, name: f.name, grams: Number(f.grams),
    kcal: Number(f.kcal), protein: Number(f.protein), fat: Number(f.fat), carbs: Number(f.carbs),
  }))

  const tgt: Record<string, number> = {}
  for (const r of targets.data ?? []) tgt[r.day] = Number(r.target_kcal)
  // días con comidas sin objetivo guardado: se calcula igual que en Diet
  const missing = [...new Set(foods.map((f) => f.day))].filter((d) => tgt[d] == null)
  for (let i = 0; i < missing.length; i += 8) {
    await Promise.all(missing.slice(i, i + 8).map(async (d) => { tgt[d] = Math.round((await computeDayEnergy(profile, d)).kcal) }))
  }

  const sets = (workouts.data ?? []).flatMap((w: any) =>
    [...(w.workout_sets ?? [])].filter((s: any) => s.done && s.exercise).sort((a: any, b: any) => a.position - b.position).map((s: any) => ({
      day: w.day, session: w.title, exercise: s.exercise.name, sets: s.sets, reps: s.reps,
      weightKg: s.weight_kg != null ? Number(s.weight_kg) : null, minutes: s.minutes != null ? Number(s.minutes) : null,
      primary: s.exercise.primary_muscles ?? [], secondary: s.exercise.secondary_muscles ?? [],
      cardio: s.exercise.category === 'cardio' || s.minutes != null,
      distanceKm: s.distance_km != null ? Number(s.distance_km) : null, watts: s.avg_watts != null ? Number(s.avg_watts) : null,
      avgHr: s.avg_hr ?? null, kcal: s.kcal != null ? Number(s.kcal) : null, kcalMethod: s.kcal_method ?? null,
    })))

  return {
    foods,
    sets,
    targets: tgt,
    weights: Object.fromEntries((weights.data ?? []).map((r: any) => [r.day, Number(r.kg)])),
    steps: Object.fromEntries((steps.data ?? []).map((r: any) => [r.day, Number(r.steps)])),
  }
}
