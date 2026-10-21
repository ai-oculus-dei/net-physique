// Cumplimiento diario de la dieta según el balance neto del día (objetivo − consumido).
// Un balance negativo = se comió por encima del objetivo.

/** Exceso sobre el objetivo a partir del cual el día es naranja (> 5 %) */
export const DIET_OVER_WARN_PCT = 5
/** Exceso sobre el objetivo a partir del cual el día es rojo (> 15 %) */
export const DIET_OVER_OFF_PCT = 15

export type DietLevel = 'green' | 'orange' | 'red'

/**
 * green: consumido ≤ objetivo + 5 % (incluye quedarse por debajo)
 * orange: exceso > 5 % y ≤ 15 %
 * red: exceso > 15 %
 * null: día sin comidas registradas o sin objetivo
 */
export function dietDayLevel(consumed: number, target: number | null | undefined): DietLevel | null {
  if (!target || target <= 0 || consumed <= 0) return null
  // redondeo a centésimas para que 5 % y 15 % exactos no cambien de lado por coma flotante
  const excess = Math.round((consumed / target - 1) * 100 * 100) / 100
  if (excess > DIET_OVER_OFF_PCT) return 'red'
  if (excess > DIET_OVER_WARN_PCT) return 'orange'
  return 'green'
}
