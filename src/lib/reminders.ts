// Avisos: peso en ayunas (cada día desde las 6:00) y % de grasa (cada 3 semanas).
// Lógica pura para decidir qué avisos mostrar.

/** Hora a partir de la cual aparecen los avisos */
export const REMINDER_FROM_HOUR = 6
/** Días entre mediciones de % de grasa */
export const BODYFAT_EVERY_DAYS = 21
/** Si la app pasa este tiempo en segundo plano, cuenta como "volver a abrirla" (los avisos cerrados reaparecen) */
export const REOPEN_AFTER_MS = 10 * 60 * 1000

export interface ReminderInput {
  now: Date
  today: string // YYYY-MM-DD local
  /** null = aún sin cargar */
  hasWeightToday: boolean | null
  /** último día con % de grasa; null = nunca; undefined = aún sin cargar */
  lastBodyFatDay: string | null | undefined
  remindWeight: boolean
  remindBodyFat: boolean
  dismissed: { weight: boolean; bodyfat: boolean }
}

export interface ReminderState {
  weight: boolean
  bodyfat: boolean
  /** días desde la última medición de grasa (null si nunca) */
  bodyFatDaysAgo: number | null
}

export function daysBetween(a: string, b: string): number {
  const t = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
  return Math.round((t(b) - t(a)) / 86400000)
}

export function reminderState(i: ReminderInput): ReminderState {
  const awake = i.now.getHours() >= REMINDER_FROM_HOUR
  const bodyFatDaysAgo = i.lastBodyFatDay ? daysBetween(i.lastBodyFatDay, i.today) : null
  const fatDue = i.lastBodyFatDay !== undefined && (bodyFatDaysAgo == null || bodyFatDaysAgo >= BODYFAT_EVERY_DAYS)
  return {
    weight: awake && i.remindWeight && i.hasWeightToday === false && !i.dismissed.weight,
    bodyfat: awake && i.remindBodyFat && fatDue && !i.dismissed.bodyfat,
    bodyFatDaysAgo,
  }
}
