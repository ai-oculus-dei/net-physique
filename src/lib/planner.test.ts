import { describe, expect, it } from 'vitest'
import { projectPlan, suggestedGrams } from './planner'
import type { Product } from './types'

const p = (kcal: number, protein: number, carbs: number, fat: number, extra: Partial<Product> = {}): Product => ({
  barcode: 'x', name: 'x', brand: null, image_url: null, kcal_100g: kcal, protein_100g: protein, carbs_100g: carbs, fat_100g: fat, serving_g: null, ...extra,
})

describe('planificador', () => {
  const consumed = { kcal: 900, protein: 60, carbs: 100, fat: 30 }
  const target = { kcal: 2000, protein: 160, carbs: 200, fat: 70 }

  it('sin plan: lo que queda es objetivo − consumido', () => {
    const r = projectPlan(consumed, [], target)
    expect(r.planned.kcal).toBe(0)
    expect(r.remaining).toEqual({ kcal: 1100, protein: 100, carbs: 100, fat: 40 })
  })

  it('suma lo planificado y calcula lo que quedaría (negativo = se pasaría)', () => {
    const r = projectPlan(consumed, [
      { product: p(80, 6, 4, 3), grams: 350 }, // 280 kcal, 21 P, 14 C, 10.5 G
      { product: p(400, 10, 70, 8), grams: 300 }, // 1200 kcal
    ], target)
    expect(r.planned.kcal).toBeCloseTo(1480, 5)
    expect(r.total.kcal).toBeCloseTo(2380, 5)
    expect(r.remaining.kcal).toBeCloseTo(-380, 5)
    expect(r.planned.protein).toBeCloseTo(51, 5)
  })

  it('cantidad sugerida: última vez > ración > 100 g', () => {
    expect(suggestedGrams({ ...p(0, 0, 0, 0, { serving_g: 125 }), lastGrams: 200 })).toBe(200)
    expect(suggestedGrams(p(0, 0, 0, 0, { serving_g: 125 }))).toBe(125)
    expect(suggestedGrams(p(0, 0, 0, 0))).toBe(100)
  })
})
