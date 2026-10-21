// Planificador: proyección de lo ya consumido + lo preseleccionado frente a los objetivos del día
import { macrosFor } from './food'
import type { Product } from './types'

export interface Macros { kcal: number; protein: number; carbs: number; fat: number }
export interface PlanItem { product: Product; grams: number }

export const MACRO_KEYS = ['kcal', 'protein', 'carbs', 'fat'] as const

export function planTotals(items: PlanItem[]): Macros {
  return items.reduce<Macros>((a, it) => {
    const m = macrosFor(it.product, it.grams)
    return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}

export interface Projection {
  consumed: Macros
  planned: Macros
  total: Macros
  target: Macros
  /** objetivo − total (negativo = se pasaría) */
  remaining: Macros
}

export function projectPlan(consumed: Macros, items: PlanItem[], target: Macros): Projection {
  const planned = planTotals(items)
  const total = {} as Macros
  const remaining = {} as Macros
  for (const k of MACRO_KEYS) {
    total[k] = consumed[k] + planned[k]
    remaining[k] = target[k] - total[k]
  }
  return { consumed, planned, total, target, remaining }
}

/** Cantidad sugerida al añadir al plan: la última que se comió, la ración o 100 g */
export const suggestedGrams = (p: Product & { lastGrams?: number }) => Number(p.lastGrams || p.serving_g || 100)
