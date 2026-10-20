// Fórmulas de gasto energético, macros y composición corporal.
// Unidades: kg, cm, años, mm (pliegues).

export type Sex = 'male' | 'female'
export type EnergyMode = 'dynamic' | 'factor' | 'adaptive'

export const ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725, 1.9] as const
export const BASELINE_FACTOR = 1.2 // sedentario + efecto térmico de los alimentos

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const

/** Mifflin-St Jeor (1990) */
export function bmrMifflin(sex: Sex, kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161)
}

/** Katch-McArdle: usa masa magra, mejor si se conoce el % de grasa */
export function bmrKatch(kg: number, bodyFatPct: number): number {
  const lbm = kg * (1 - bodyFatPct / 100)
  return 370 + 21.6 * lbm
}

export function bmr(sex: Sex, kg: number, cm: number, age: number, bodyFatPct?: number | null): number {
  return bodyFatPct != null && bodyFatPct > 3 && bodyFatPct < 60
    ? bmrKatch(kg, bodyFatPct)
    : bmrMifflin(sex, kg, cm, age)
}

export function activityFactor(level: number): number {
  const i = Math.min(5, Math.max(1, Math.round(level))) - 1
  return ACTIVITY_FACTORS[i]
}

/** kcal = MET × kg × horas (Compendium of Physical Activities) */
export function metKcal(met: number, kg: number, minutes: number): number {
  return met * kg * (minutes / 60)
}

export const MET_BY_CATEGORY: Record<string, number> = {
  strength: 5.0,
  powerlifting: 6.0,
  'olympic weightlifting': 6.0,
  strongman: 6.0,
  plyometrics: 8.0,
  cardio: 7.0,
  stretching: 2.3,
}

export const STRENGTH_MET = { light: 3.5, moderate: 5.0, vigorous: 6.0 } as const

/** Duración estimada de un bloque de series (s por rep + descanso) en minutos */
export function setsMinutes(sets: number, reps: number, restSec = 90, secPerRep = 3): number {
  return (sets * (reps * secPerRep + restSec)) / 60
}

/** Pasos → kcal netas. Zancada ≈ altura × 0.415; caminar ≈ 0.5 kcal/kg/km */
export function stepsKcal(steps: number, kg: number, cm: number): number {
  const km = (steps * cm * 0.415) / 100000
  return 0.5 * kg * km
}

/** Gasto dinámico: basal × 1.2 + pasos + entreno */
export function dynamicTdee(bmrKcal: number, stepsK: number, trainingK: number): number {
  return bmrKcal * BASELINE_FACTOR + stepsK + trainingK
}

/**
 * Factor adaptativo: media de (gasto dinámico / basal) de los últimos días registrados,
 * acotado a [1.2, 2.0]. Devuelve null si no hay suficientes días.
 */
export function adaptiveFactor(dailyRatios: number[], minDays = 7): number | null {
  const valid = dailyRatios.filter((r) => Number.isFinite(r) && r > 0)
  if (valid.length < minDays) return null
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  return Math.min(2.0, Math.max(1.2, Math.round(avg * 1000) / 1000))
}

export interface MacroTargets {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

/** Proteína y grasa por g/kg; carbohidratos con lo que queda */
export function macroTargets(tdee: number, deficit: number, kg: number, proteinGkg: number, fatGkg: number): MacroTargets {
  const kcal = Math.max(1000, tdee - deficit)
  const protein = proteinGkg * kg
  const fat = fatGkg * kg
  const carbs = Math.max(0, (kcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs)
  return { kcal, protein, fat, carbs }
}

// ---------- Composición corporal ----------

/** Siri (1961): densidad → % grasa */
export function siri(density: number): number {
  return 495 / density - 450
}

/** Jackson-Pollock 3 pliegues. H: pecho, abdomen, muslo · M: tríceps, suprailíaco, muslo */
export function jp3Density(sex: Sex, sumMm: number, age: number): number {
  return sex === 'male'
    ? 1.10938 - 0.0008267 * sumMm + 0.0000016 * sumMm ** 2 - 0.0002574 * age
    : 1.0994921 - 0.0009929 * sumMm + 0.0000023 * sumMm ** 2 - 0.0001392 * age
}

/** Jackson-Pollock 7 pliegues: pecho, axilar, tríceps, subescapular, abdomen, suprailíaco, muslo */
export function jp7Density(sex: Sex, sumMm: number, age: number): number {
  return sex === 'male'
    ? 1.112 - 0.00043499 * sumMm + 0.00000055 * sumMm ** 2 - 0.00028826 * age
    : 1.097 - 0.00046971 * sumMm + 0.00000056 * sumMm ** 2 - 0.00012828 * age
}

export function skinfoldBodyFat(method: 'jp3' | 'jp7', sex: Sex, folds: number[], age: number): number {
  const sum = folds.reduce((a, b) => a + b, 0)
  const d = method === 'jp3' ? jp3Density(sex, sum, age) : jp7Density(sex, sum, age)
  return siri(d)
}

/** US Navy (Hodgdon & Beckett), medidas en cm */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipCm = 0): number {
  if (sex === 'male') {
    return 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450
  }
  return 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450
}

// ---------- Peso ----------

/** Media móvil exponencial (tendencia de peso) */
export function ewma(values: number[], alpha = 0.1): number[] {
  const out: number[] = []
  values.forEach((v, i) => out.push(i === 0 ? v : alpha * v + (1 - alpha) * out[i - 1]))
  return out
}

/** 1RM estimado (Epley) */
export function epley1rm(kg: number, reps: number): number {
  return reps <= 1 ? kg : kg * (1 + reps / 30)
}

export function ageFromBirthdate(birth: string, today = new Date()): number {
  const b = new Date(birth)
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--
  return age
}
