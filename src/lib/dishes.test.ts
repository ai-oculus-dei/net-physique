import { describe, expect, it } from 'vitest'
import { dishTotals, toGrams, type Ingredient } from './dishes'
import type { Product } from './types'

const p = (kcal: number, protein: number, carbs: number, fat: number, serving_g: number | null = null): Product => ({
  barcode: String(kcal), name: 'x', brand: null, image_url: null,
  kcal_100g: kcal, protein_100g: protein, carbs_100g: carbs, fat_100g: fat, serving_g,
})

describe('platos', () => {
  it('unidades a gramos', () => {
    expect(toGrams(2, 'cda', p(0, 0, 0, 0))).toBe(30)
    expect(toGrams(3, 'cdta', p(0, 0, 0, 0))).toBe(15)
    expect(toGrams(1, 'ud', p(0, 0, 0, 0, 125))).toBe(125)
    expect(toGrams(1, 'ud', p(0, 0, 0, 0))).toBe(100)
  })

  // Judías verdes: 400 g judías (25 kcal) + 80 g jamón (240 kcal) + 2 cda tomate (80 kcal) + 50 ml vino (85 kcal)
  const items: Ingredient[] = [
    { product: p(25, 1.6, 3.5, 0.2), amount: 400, unit: 'g' },
    { product: p(240, 30, 0.5, 13), amount: 80, unit: 'g' },
    { product: p(80, 1.5, 11, 3.5), amount: 2, unit: 'cda' },
    { product: p(85, 0.1, 2.6, 0), amount: 50, unit: 'ml' },
  ]

  it('kcal por 100 g con el peso crudo', () => {
    const t = dishTotals(items)
    expect(t.rawGrams).toBe(560)
    expect(t.kcal).toBeCloseTo(100 + 192 + 24 + 42.5, 5)
    expect(t.per100.kcal).toBeCloseTo((358.5 / 560) * 100, 5)
  })

  it('con peso final cocinado (pierde agua) sube la densidad', () => {
    const t = dishTotals(items, 450)
    expect(t.finalGrams).toBe(450)
    expect(t.kcal).toBeCloseTo(358.5, 5)
    expect(t.per100.kcal).toBeCloseTo((358.5 / 450) * 100, 5)
  })
})
