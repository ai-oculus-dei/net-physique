// Cardio: kcal por actividad con el mejor dato disponible.
// Prioridad: potencia (W) > kcal de la máquina > frecuencia cardiaca > distancia + tiempo > MET por intensidad.
// Se devuelven kcal NETAS (se resta 1 MET de reposo) porque el basal × 1.2 ya cubre ese gasto.
import type { Sex } from './formulas'

export type Intensity = 'light' | 'moderate' | 'vigorous'
export type CardioField = 'distance' | 'watts' | 'machineKcal' | 'hr'
export type CardioMethod = 'watts' | 'machine' | 'hr' | 'distance' | 'met'

export interface CardioActivity {
  id: string // = exercises.id
  name: string
  /** MET (Compendium of Physical Activities) para suave / media / intensa */
  met: Record<Intensity, number>
  /** datos opcionales que admite además del tiempo y la FC */
  fields: CardioField[]
  /** cómo convertir vatios en kcal */
  power?: 'concept2' | 'cycling'
}

export const CARDIO: CardioActivity[] = [
  { id: 'cardio_running', name: 'Running', met: { light: 8.3, moderate: 9.8, vigorous: 11.8 }, fields: ['distance', 'hr'] },
  { id: 'cardio_eliptica', name: 'Elíptica', met: { light: 4.0, moderate: 5.0, vigorous: 7.0 }, fields: ['machineKcal', 'hr'] },
  { id: 'cardio_bici', name: 'Bici estática', met: { light: 4.8, moderate: 6.8, vigorous: 8.8 }, fields: ['watts', 'machineKcal', 'hr'], power: 'cycling' },
  { id: 'cardio_assault', name: 'Assault Bike', met: { light: 7.0, moderate: 9.0, vigorous: 11.0 }, fields: ['watts', 'machineKcal', 'hr'], power: 'cycling' },
  { id: 'cardio_remo', name: 'Remo (ergómetro)', met: { light: 4.8, moderate: 7.0, vigorous: 8.5 }, fields: ['watts', 'machineKcal', 'hr'], power: 'concept2' },
  { id: 'cardio_skierg', name: 'SkiErg', met: { light: 5.0, moderate: 6.8, vigorous: 9.0 }, fields: ['watts', 'machineKcal', 'hr'], power: 'concept2' },
  { id: 'cardio_padel', name: 'Pádel', met: { light: 5.0, moderate: 6.0, vigorous: 7.5 }, fields: ['hr'] },
]
/** Cardio genérico (ejercicios de cardio del catálogo que no son de la lista) */
export const GENERIC_CARDIO_MET: Record<Intensity, number> = { light: 5.0, moderate: 7.0, vigorous: 9.0 }

export const cardioActivity = (exerciseId: string) => CARDIO.find((a) => a.id === exerciseId) ?? null

export const METHOD_LABEL: Record<CardioMethod, string> = {
  watts: 'por potencia', machine: 'kcal de la máquina', hr: 'por pulsaciones', distance: 'por ritmo', met: 'por intensidad',
}

/** Running: MET según velocidad (Compendium), interpolado */
const RUN_MET: [number, number][] = [
  [6.4, 6.0], [8.0, 8.3], [8.4, 9.0], [9.7, 9.8], [10.8, 10.5], [11.3, 11.0], [12.1, 11.8],
  [12.9, 11.8], [13.8, 12.3], [14.5, 12.8], [16.1, 14.5], [17.7, 16.0], [19.3, 19.0], [20.9, 19.8], [22.5, 23.0],
]
export function runningMet(kmh: number): number {
  if (kmh <= RUN_MET[0][0]) return RUN_MET[0][1]
  for (let i = 1; i < RUN_MET.length; i++) {
    const [x1, y1] = RUN_MET[i]
    if (kmh <= x1) {
      const [x0, y0] = RUN_MET[i - 1]
      return y0 + ((kmh - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return RUN_MET[RUN_MET.length - 1][1]
}

/** Concept2 (remo, SkiErg): kcal/h = 4 × W × 0.8604 + 300 */
export const concept2KcalPerHour = (watts: number) => 4 * watts * 0.8604 + 300
/** Bici: trabajo mecánico / eficiencia bruta (~21 %) */
export const CYCLING_EFFICIENCY = 0.21
export const cyclingKcal = (watts: number, minutes: number) => (watts * minutes * 60) / 4184 / CYCLING_EFFICIENCY

/** Keytel et al. (2005): kcal/min a partir de la FC media */
export function keytelKcalPerMin(sex: Sex, hr: number, kg: number, age: number): number {
  const kj = sex === 'male'
    ? -55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age
    : -20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age
  return Math.max(0, kj / 4.184)
}

export interface CardioInput {
  exerciseId: string
  minutes: number
  intensity?: Intensity | null
  distanceKm?: number | null
  watts?: number | null
  avgHr?: number | null
  machineKcal?: number | null
}
export interface Body { kg: number; sex: Sex; age: number }
export interface CardioResult { gross: number; net: number; method: CardioMethod }

export function cardioKcal(i: CardioInput, b: Body): CardioResult {
  const a = cardioActivity(i.exerciseId)
  const min = Math.max(0, i.minutes || 0)
  const h = min / 60
  const intensity = i.intensity ?? 'moderate'
  let gross: number
  let method: CardioMethod

  if (a?.power && i.watts && i.watts > 0 && min > 0) {
    gross = a.power === 'concept2' ? concept2KcalPerHour(i.watts) * h : cyclingKcal(i.watts, min)
    method = 'watts'
  } else if (i.machineKcal && i.machineKcal > 0) {
    gross = i.machineKcal
    method = 'machine'
  } else if (i.avgHr && i.avgHr > 60 && min > 0) {
    gross = keytelKcalPerMin(b.sex, i.avgHr, b.kg, b.age) * min
    method = 'hr'
  } else if (a?.id === 'cardio_running' && i.distanceKm && i.distanceKm > 0) {
    // con tiempo: MET de la velocidad; sin tiempo: ≈ 1 kcal por kg y km
    gross = min > 0 ? runningMet(i.distanceKm / h) * b.kg * h : b.kg * i.distanceKm
    method = 'distance'
  } else {
    gross = (a?.met ?? GENERIC_CARDIO_MET)[intensity] * b.kg * h
    method = 'met'
  }
  // neto: se resta el reposo (1 MET = 1 kcal/kg/h) de ese tiempo
  const net = Math.max(0, gross - b.kg * h)
  return { gross, net, method }
}
