// Unidad de referencia de un producto: los valores nutricionales son por 100 g o por 100 ml.
import type { Product } from './types'

export type FoodUnit = 'g' | 'ml'

export const unitOf = (p: Pick<Product, 'unit'> | null | undefined): FoodUnit => (p?.unit === 'ml' ? 'ml' : 'g')

/**
 * Deduce la unidad a partir de los datos de Open Food Facts.
 * Sus campos *_100g son "por 100 g o por 100 ml": manda la unidad de la cantidad del envase o de la ración.
 * (Misma lógica que supabase/functions/food-lookup.)
 */
export function detectUnit(off: { product_quantity_unit?: string | null; serving_quantity_unit?: string | null; quantity?: string | null; serving_size?: string | null }): FoodUnit {
  const u = (off.product_quantity_unit || off.serving_quantity_unit || '').toLowerCase().trim()
  if (u) return u === 'ml' || u === 'cl' || u === 'l' ? 'ml' : 'g'
  const text = `${off.quantity ?? ''} ${off.serving_size ?? ''}`.toLowerCase()
  // "330 ml", "1,5 l", "75cl", "1 L" … pero no "lb"
  if (/\d\s*(ml|cl|dl|l|litros?)\b/.test(text)) return 'ml'
  return 'g'
}
