// Cálculo de gasto y objetivos del día a partir del perfil y los registros.
import { supabase } from './supabase'
import { addDays } from './dates'
import {
  BASELINE_FACTOR, MET_BY_CATEGORY, STRENGTH_MET, activityFactor, adaptiveFactor, ageFromBirthdate,
  bmrDetail, dynamicTdee, macroTargets, type BmrDetail, type BmrFormula, metKcal, setsMinutes, stepsKcal, type MacroTargets,
} from './formulas'
import type { Profile, WorkoutSet } from './types'
import { cardioKcal, type Body, type CardioResult } from './cardio'

export interface DayEnergy extends MacroTargets {
  bmr: number
  /** fórmula del basal usada y si hubo que caer a Mifflin */
  bmrFormula: BmrDetail['used']
  bmrFallback: boolean
  /** % de grasa usado (Katch-McArdle) o el último disponible */
  bodyFat: { pct: number; day: string } | null
  tdee: number
  stepsKcal: number
  trainingKcal: number
  factorUsed: number | null
  weightKg: number
  suggestedFactor: number | null
}

/** El ejercicio es cardio (actividad de la app o cardio del catálogo) */
export const isCardio = (s: Pick<WorkoutSet, 'exercise' | 'minutes'>) => s.exercise.category === 'cardio' || s.minutes != null

/** kcal netas de una actividad de cardio del entreno */
export function cardioSetKcal(s: WorkoutSet, body: Body): CardioResult {
  return cardioKcal({
    exerciseId: s.exercise_id, minutes: Number(s.minutes ?? 0), intensity: s.intensity,
    distanceKm: s.distance_km, watts: s.avg_watts, avgHr: s.avg_hr, machineKcal: s.machine_kcal,
  }, body)
}

/**
 * kcal NETAS de un entreno (sin el reposo, que ya cuenta el basal × 1.2):
 * cardio por actividad (lib/cardio) + fuerza por MET − 1.
 * La fuerza usa la duración real de la sesión (menos los minutos de cardio) si se indica; si no, se estima por series.
 */
export function workoutKcal(sets: WorkoutSet[], body: Body, intensity: keyof typeof STRENGTH_MET, durationMin?: number | null) {
  const cardio = sets.filter(isCardio)
  const strength = sets.filter((s) => !isCardio(s))
  const cardioK = cardio.reduce((a, s) => a + cardioSetKcal(s, body).net, 0)
  const cardioMin = cardio.reduce((a, s) => a + Number(s.minutes ?? 0), 0)
  let strengthK = 0
  if (strength.length) {
    if (durationMin && durationMin > 0) {
      strengthK = metKcal(STRENGTH_MET[intensity] - 1, body.kg, Math.max(0, durationMin - cardioMin))
    } else {
      strengthK = strength.reduce((a, s) => {
        const cat = s.exercise.category ?? 'strength'
        const met = cat === 'strength' ? STRENGTH_MET[intensity] : MET_BY_CATEGORY[cat] ?? STRENGTH_MET[intensity]
        return a + metKcal(met - 1, body.kg, setsMinutes(s.sets, s.reps))
      }, 0)
    }
  }
  return cardioK + strengthK
}

/** Datos corporales para los cálculos de gasto */
export function bodyFrom(profile: Pick<Profile, 'sex' | 'birthdate'>, kg: number): Body {
  return { kg, sex: profile.sex ?? 'male', age: profile.birthdate ? ageFromBirthdate(profile.birthdate) : 30 }
}

/** Peso de referencia: media de los últimos 7 pesajes hasta ese día; si no hay, el del perfil */
export async function weightRef(profile: { weight_kg?: number | null }, day: string): Promise<{ kg: number; weighings: number }> {
  const { data } = await supabase.from('weights').select('kg').lte('day', day).order('day', { ascending: false }).limit(7)
  if (data && data.length) return { kg: data.reduce((a, r) => a + Number(r.kg), 0) / data.length, weighings: data.length }
  return { kg: Number(profile.weight_kg ?? 70), weighings: 0 }
}

export async function latestWeight(profile: Profile, day: string): Promise<number> {
  return (await weightRef(profile, day)).kg
}

/** Último % de grasa de los 60 días anteriores (el que usa Katch-McArdle) */
export async function latestBodyFat(day: string): Promise<{ pct: number; day: string } | null> {
  const since = addDays(day, -60)
  const { data } = await supabase.from('body_fat').select('pct,day').gte('day', since).lte('day', day)
    .order('day', { ascending: false }).limit(1)
  return data?.[0]?.pct != null ? { pct: Number(data[0].pct), day: data[0].day } : null
}

export async function computeDayEnergy(profile: Profile, day: string): Promise<DayEnergy> {
  const [{ kg }, bodyFat] = await Promise.all([weightRef(profile, day), latestBodyFat(day)])
  const age = profile.birthdate ? ageFromBirthdate(profile.birthdate) : 30
  const detail = bmrDetail((profile.bmr_formula ?? 'auto') as BmrFormula, profile.sex ?? 'male', kg, Number(profile.height_cm ?? 170), age, bodyFat?.pct)
  const base = detail.kcal

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
    ...targets, bmr: base, bmrFormula: detail.used, bmrFallback: detail.fallback, bodyFat, tdee, stepsKcal: sk(day), trainingKcal: tk(day), factorUsed, weightKg: kg,
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
