// Balance de 7 días: lógica pura (sin red ni React) para el semáforo de calorías,
// la variabilidad diaria y la tendencia de peso.
import { addDays } from './dates'

// ---- Constantes ajustables ----
export const BALANCE_WINDOW_DAYS = 7
/** Mínimo de días registrados para dar veredicto */
export const BALANCE_MIN_DAYS = 3
/** |desviación| < IN_RANGE_PCT → azul */
export const IN_RANGE_PCT = 10
/** IN_RANGE_PCT ≤ |desviación| ≤ OFF_PCT → naranja; por encima → rojo */
export const OFF_PCT = 15
/** Días "con mucha diferencia": por debajo del 70 % o por encima del 130 % de su objetivo */
export const EXTREME_LOW = 0.7
export const EXTREME_HIGH = 1.3
/** Rango de la regla horizontal (±%) */
export const RULER_PCT = 25
/** Pesajes mínimos en cada ventana para mostrar la tendencia */
export const MIN_WEIGHINGS = 3

export type BalanceStatus = 'nodata' | 'ok' | 'warn' | 'off'

export interface BalanceDay {
  fecha: string // YYYY-MM-DD
  objetivo: number // kcal objetivo de ese día
  consumido: number // kcal registradas ese día (0 = sin registros)
}

export interface BalanceResult {
  status: BalanceStatus
  /** % con signo: (Σ consumido / Σ objetivo − 1) × 100; null si no hay días */
  deviation: number | null
  direction: 'above' | 'below' | null
  /** media diaria de kcal consumidas en los días registrados */
  avgConsumed: number | null
  avgTarget: number | null
  /** días registrados dentro de la ventana */
  days: number
  /** días registrados con consumo < 70 % o > 130 % de su objetivo */
  extremeDays: number
  /** primer y último día de la ventana (ayer) */
  from: string
  to: string
}

/**
 * Ventana: los BALANCE_WINDOW_DAYS días anteriores a `today` (hoy no cuenta, está incompleto).
 * Se ignoran los días sin comidas registradas y los que no tienen objetivo.
 */
export function computeBalance(input: BalanceDay[], today: string): BalanceResult {
  const to = addDays(today, -1)
  const from = addDays(today, -BALANCE_WINDOW_DAYS)
  const days = input.filter((d) => d.fecha >= from && d.fecha <= to && d.consumido > 0 && d.objetivo > 0)

  const n = days.length
  const base = { from, to, days: n }
  if (n === 0) {
    return { ...base, status: 'nodata', deviation: null, direction: null, avgConsumed: null, avgTarget: null, extremeDays: 0 }
  }

  const sumC = days.reduce((a, d) => a + d.consumido, 0)
  const sumT = days.reduce((a, d) => a + d.objetivo, 0)
  // redondeo a centésimas para que 10 % o 15 % exactos no caigan al lado equivocado por coma flotante
  const deviation = Math.round((sumC / sumT - 1) * 100 * 100) / 100
  const extremeDays = days.filter((d) => d.consumido < d.objetivo * EXTREME_LOW || d.consumido > d.objetivo * EXTREME_HIGH).length
  const abs = Math.abs(deviation)

  let status: BalanceStatus
  if (n < BALANCE_MIN_DAYS) status = 'nodata'
  else if (abs < IN_RANGE_PCT) status = 'ok'
  else if (abs <= OFF_PCT) status = 'warn'
  else status = 'off'

  return {
    ...base,
    status,
    deviation,
    direction: status === 'warn' || status === 'off' ? (deviation > 0 ? 'above' : 'below') : null,
    avgConsumed: sumC / n,
    avgTarget: sumT / n,
    extremeDays,
  }
}

export interface WeightPoint { fecha: string; kg: number }

export interface WeightTrend {
  /** media de los últimos 7 días (hoy incluido: el pesaje en ayunas ya está completo) */
  recent: number | null
  previous: number | null
  recentCount: number
  previousCount: number
  /** recent − previous; las ventanas distan 7 días, así que equivale a kg/semana */
  deltaKg: number | null
  enough: boolean
}

export function computeWeightTrend(points: WeightPoint[], today: string): WeightTrend {
  const inRange = (a: string, b: string) => points.filter((p) => p.fecha >= a && p.fecha <= b && p.kg > 0)
  const r = inRange(addDays(today, -6), today)
  const p = inRange(addDays(today, -13), addDays(today, -7))
  const avg = (xs: WeightPoint[]) => (xs.length ? xs.reduce((a, x) => a + x.kg, 0) / xs.length : null)
  const recent = avg(r)
  const previous = avg(p)
  const enough = r.length >= MIN_WEIGHINGS && p.length >= MIN_WEIGHINGS
  return {
    recent, previous, recentCount: r.length, previousCount: p.length, enough,
    deltaKg: enough && recent != null && previous != null ? Math.round((recent - previous) * 100) / 100 : null,
  }
}

/** Posición (0–100 %) del marcador en la regla de −RULER_PCT a +RULER_PCT, acotada a los extremos */
export function rulerPosition(deviation: number): number {
  const clamped = Math.max(-RULER_PCT, Math.min(RULER_PCT, deviation))
  return ((clamped + RULER_PCT) / (2 * RULER_PCT)) * 100
}
