// Platos cocinados: producto (source 'dish') + ingredientes. Valores por 100 g del plato terminado.
import { supabase } from './supabase'
import { macrosFor } from './food'
import type { Product } from './types'

export type Unit = 'g' | 'ml' | 'cda' | 'cdta' | 'ud'
export const UNITS: { id: Unit; label: string; grams?: number }[] = [
  { id: 'g', label: 'g', grams: 1 },
  { id: 'ml', label: 'ml', grams: 1 },
  { id: 'cda', label: 'cucharada', grams: 15 },
  { id: 'cdta', label: 'cucharadita', grams: 5 },
  { id: 'ud', label: 'ración' },
]

export interface Ingredient {
  product: Product
  amount: number
  unit: Unit
}

/** Cantidad → gramos. "ración" usa la ración del producto (o 100 g si no tiene) */
export function toGrams(amount: number, unit: Unit, product: Pick<Product, 'serving_g'>): number {
  const u = UNITS.find((x) => x.id === unit)!
  return amount * (u.grams ?? Number(product.serving_g || 100))
}

export interface DishTotals {
  rawGrams: number
  finalGrams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  per100: { kcal: number; protein: number; carbs: number; fat: number }
}

export function dishTotals(items: Ingredient[], cookedGrams?: number | null): DishTotals {
  const t = { rawGrams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const it of items) {
    const g = toGrams(it.amount, it.unit, it.product)
    const m = macrosFor(it.product, g)
    t.rawGrams += g; t.kcal += m.kcal; t.protein += m.protein; t.carbs += m.carbs; t.fat += m.fat
  }
  const finalGrams = cookedGrams && cookedGrams > 0 ? cookedGrams : t.rawGrams
  const f = finalGrams > 0 ? 100 / finalGrams : 0
  return {
    ...t, finalGrams,
    per100: { kcal: t.kcal * f, protein: t.protein * f, carbs: t.carbs * f, fat: t.fat * f },
  }
}

export interface DishDraft {
  barcode?: string
  name: string
  cookedGrams: number | null
  servingGrams: number | null
  items: Ingredient[]
}

export async function listDishes(): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*').eq('source', 'dish').order('name')
  return (data ?? []) as Product[]
}

export async function loadDish(dish: Product): Promise<DishDraft> {
  const { data, error } = await supabase.from('dish_ingredients').select('amount, unit, products!dish_ingredients_barcode_fkey(*)')
    .eq('dish_barcode', dish.barcode).order('position')
  if (error) throw error
  return {
    barcode: dish.barcode,
    name: dish.name,
    cookedGrams: dish.dish_total_g ?? null,
    servingGrams: dish.serving_g,
    items: ((data ?? []) as any[]).filter((r) => r.products).map((r) => ({
      product: r.products as Product, amount: Number(r.amount), unit: r.unit as Unit,
    })),
  }
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

export async function saveDish(d: DishDraft): Promise<Product> {
  const t = dishTotals(d.items, d.cookedGrams)
  const barcode = d.barcode ?? `dish-${crypto.randomUUID().slice(0, 8)}`
  const row = {
    barcode, name: d.name.trim(), brand: 'Plato cocinado', image_url: null, source: 'dish',
    kcal_100g: round(t.per100.kcal, 1), protein_100g: round(t.per100.protein), carbs_100g: round(t.per100.carbs),
    fat_100g: round(t.per100.fat), serving_g: d.servingGrams, dish_total_g: d.cookedGrams,
    updated_at: new Date().toISOString(),
  }
  const { error } = d.barcode
    ? await supabase.from('products').update(row).eq('barcode', barcode)
    : await supabase.from('products').insert(row)
  if (error) throw error

  // Los ingredientes se reemplazan por completo; se guarda una foto de sus macros
  await supabase.from('dish_ingredients').delete().eq('dish_barcode', barcode)
  const rows = d.items.map((it, i) => {
    const grams = toGrams(it.amount, it.unit, it.product)
    return {
      dish_barcode: barcode, position: i, barcode: it.product.barcode, name: it.product.name,
      amount: it.amount, unit: it.unit, grams: round(grams, 1), ...macrosFor(it.product, grams),
    }
  })
  if (rows.length) {
    const { error: e2 } = await supabase.from('dish_ingredients').insert(rows)
    if (e2) throw e2
  }
  return row as Product
}

export async function deleteDish(barcode: string) {
  const { error } = await supabase.from('products').delete().eq('barcode', barcode).eq('source', 'dish')
  if (error) throw error
}
