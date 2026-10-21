// Cumplimiento diario de la dieta.
// 1) Exceso: balance neto del día (objetivo − consumido); negativo = se comió por encima.
// 2) Quedarse corto: consumido por debajo del objetivo más allá de la tolerancia del perfil.
// 3) Proteína: por debajo del mínimo (% del objetivo de proteína) del perfil.

/** Exceso sobre el objetivo a partir del cual el día es naranja (> 5 %) */
export const DIET_OVER_WARN_PCT = 5
/** Exceso sobre el objetivo a partir del cual el día es rojo (> 15 %) */
export const DIET_OVER_OFF_PCT = 15

export type DietLevel = 'green' | 'orange' | 'red'
export type DietReason = 'over' | 'under' | 'protein'

// redondeo a centésimas para que los porcentajes exactos no cambien de lado por coma flotante
const pct = (a: number, b: number) => Math.round((a / b - 1) * 100 * 100) / 100

/**
 * Solo el exceso de kcal:
 * green ≤ +5 % (incluye quedarse por debajo) · orange > +5 % y ≤ +15 % · red > +15 % · null sin datos
 */
export function dietDayLevel(consumed: number, target: number | null | undefined): DietLevel | null {
  if (!target || target <= 0 || consumed <= 0) return null
  const excess = pct(consumed, target)
  if (excess > DIET_OVER_OFF_PCT) return 'red'
  if (excess > DIET_OVER_WARN_PCT) return 'orange'
  return 'green'
}

export interface DietDayInput {
  consumed: number
  target: number | null | undefined
  protein?: number
  proteinTarget?: number | null
  /** tolerancia por debajo del objetivo (% del perfil, p. ej. 10) */
  underTolPct: number
  /** proteína mínima (% del objetivo, p. ej. 90) */
  proteinMinPct: number
  /** false para el día en curso: aún puede comer, así que no se juzga quedarse corto ni la proteína */
  complete: boolean
}

export interface DietDayStatus { level: DietLevel; reasons: DietReason[] }

/**
 * Combina los tres criterios. El exceso manda (puede dar rojo);
 * quedarse corto o con poca proteína baja un día verde a naranja, nunca a rojo.
 */
export function dietDayStatus(i: DietDayInput): DietDayStatus | null {
  const base = dietDayLevel(i.consumed, i.target)
  if (!base) return null
  const reasons: DietReason[] = base === 'green' ? [] : ['over']
  if (i.complete) {
    if (pct(i.consumed, i.target!) < -i.underTolPct) reasons.push('under')
    if (i.proteinTarget && i.proteinTarget > 0 && (i.protein ?? 0) < i.proteinTarget * (i.proteinMinPct / 100)) {
      reasons.push('protein')
    }
  }
  const level: DietLevel = base === 'red' ? 'red' : reasons.length ? 'orange' : 'green'
  return { level, reasons }
}
