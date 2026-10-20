// Cálculo de gasto y objetivos del día a partir del perfil y los registros.
import { supabase } from './supabase'
import { addDays } from './dates'
import {
  BASELINE_FACTOR, MET_BY_CATEGORY, STRENGTH_MET, activityFactor, adaptiveFactor, ageFromBirthdate,
  bmr, dynamicTdee, macroTargets, metKcal, setsMinutes, stepsKcal, type MacroTargets,
} from './formulas'
import type { Profile, WorkoutSet } from './types'

export interface DayEnergy extends MacroTargets {
  bmr: number
  tdee: number
  stepsKcal: number
  trainingKcal: number
  factorUsed: number | null
  weightKg: number
  suggestedFactor: number | null
}

/** kcal estimadas de un entreno: duración real si existe; si no, suma por ejercicio */
export function workoutKcal(sets: WorkoutSet[], kg: number, intensity: keyof typeof STRENGTH_MET, durationMin?: number | null) {
  if (durationMin && durationMin > 0) return metKcal(STRENGTH_MET[intensity], kg, durationMin)
  return sets.reduce((acc, s) => {
    const cat = s.exercise.category ?? 'strength'
    if (cat === 'cardio' || s.minutes) {
      return acc + metKcal(MET_BY_CATEGORY.cardio, kg, s.minutes ?? 10)
    }
    const met = cat === 'strength' ? STRENGTH_MET[intensity] : MET_BY_CATEGORY[cat] ?? STRENGTH_MET[intensity]
    return acc + metKcal(met, kg, setsMinutes(s.sets, s.reps))
  }, 0)
}

export async function latestWeight(profile: Profile, day: string): Promise<number> {
  const { data } = await supabase.from('weights').select('kg').lte('day', day).order('day', { ascending: false }).limit(7)
  if (data && data.length) return data.reduce((a, r) => a + Number(r.kg), 0) / data.length
  return Number(profile.weight_kg ?? 70)
}

async function latestBodyFat(day: string): Promise<number | null> {
  const since = addDays(day, -60)
  const { data } = await supabase.from('body_fat').select('pct').gte('day', since).lte('day', day)
    .order('day', { ascending: false }).limit(1)
  return data?.[0]?.pct != null ? Number(data[0].pct) : null
}

export async function computeDayEnergy(profile: Profile, day: string): Promise<DayEnergy> {
  const kg = await latestWeight(profile, day)
  const age = profile.birthdate ? ageFromBirthdate(profile.birthdate) : 30
  const base = bmr(profile.sex ?? 'male', kg, Number(profile.height_cm ?? 170), age, await latestBodyFat(day))

  const since = addDays(day, -13)
  const [{ data: steps }, { data: wos }] = await Promise.all([
    supabase.from('steps').select('day,kcal').gte('day', since).lte('day', day),
    supabase.from('workouts').select('day,kcal').eq('planned', false).gte('day', since).lte('day', day),
  ])
  const sk = (d: string) => (steps ?? []).filter((s) => s.day === d).reduce((a, s) => a + Number(s.kcal ?? 0), 0)
  const tk = (d: string) => (wos ?? []).filter((w) => w.day === d).reduce((a, w) => a + Number(w.kcal ?? 0), 0)

  // ratio de los días con algún registro de actividad (pasos) en los últimos 14 días
  const ratios: number[] = []
  for (let i = 0; i < 14; i++) {
    const d = addDays(day, -i)
    if ((steps ?? []).some((s) => s.day === d)) ratios.push(dynamicTdee(base, sk(d), tk(d)) / base)
  }
  const suggested = adaptiveFactor(ratios)

  let tdee: number
  let factorUsed: number | null = null
  if (profile.energy_mode === 'dynamic') {
    tdee = dynamicTdee(base, sk(day), tk(day))
  } else {
    factorUsed = profile.energy_mode === 'adaptive' && suggested
      ? suggested
      : Number(profile.activity_factor || activityFactor(profile.activity_level))
    tdee = base * factorUsed
  }

  const targets = macroTargets(tdee, Number(profile.deficit_kcal), kg, Number(profile.protein_g_kg), Number(profile.fat_g_kg))
  return {
    ...targets, bmr: base, tdee, stepsKcal: sk(day), trainingKcal: tk(day), factorUsed, weightKg: kg,
    suggestedFactor: suggested,
  }
}

/** Guarda el snapshot del día (para calendario de cumplimiento) */
export async function saveDayEnergy(day: string, e: DayEnergy) {
  await supabase.from('daily_energy').upsert({
    day, bmr: Math.round(e.bmr), tdee: Math.round(e.tdee), target_kcal: Math.round(e.kcal), target_protein: Math.round(e.protein),
  })
}

export { stepsKcal, BASELINE_FACTOR }
