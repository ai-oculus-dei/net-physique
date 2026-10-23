// Productos: caché propia en Supabase → Open Food Facts (vía Edge Function food-lookup)
import { supabase } from './supabase'
import type { Product } from './types'

async function invoke(params: Record<string, string>): Promise<Product[]> {
  const qs = new URLSearchParams(params).toString()
  const { data, error } = await supabase.functions.invoke(`food-lookup?${qs}`, { method: 'GET' })
  if (error) throw error
  return (data?.products ?? []) as Product[]
}

export async function lookupBarcode(barcode: string): Promise<Product | null> {
  // 1º caché local (sin pasar por la función)
  const { data } = await supabase.from('products').select('*').eq('barcode', barcode).maybeSingle()
  if (data) return data as Product
  const list = await invoke({ barcode })
  return list[0] ?? null
}

/** Búsqueda por texto y/o marca (en caché y en Open Food Facts); onlySpain filtra productos vendidos en España */
export async function searchProducts(q: string, opts: { brand?: string; store?: string; onlySpain?: boolean } = {}): Promise<Product[]> {
  const brand = opts.brand?.trim() ?? ''
  const store = opts.store?.trim() ?? ''
  if (!brand && !store && /^\d{8,14}$/.test(q)) {
    const p = await lookupBarcode(q)
    return p ? [p] : []
  }
  const params: Record<string, string> = {}
  if (q) params.q = q
  if (brand) params.brand = brand
  if (store) params.store = store
  if (opts.onlySpain) params.es = '1'
  return invoke(params)
}

/** Guarda un producto de búsqueda remota en la caché al usarlo */
/** Columnas de la tabla products (los objetos de la app pueden llevar campos extra, p. ej. del histórico) */
const PRODUCT_COLUMNS = [
  'barcode', 'name', 'brand', 'image_url', 'kcal_100g', 'protein_100g', 'carbs_100g', 'sugars_100g', 'fat_100g',
  'sat_fat_100g', 'fiber_100g', 'salt_100g', 'serving_g', 'raw_json', 'source', 'unit',
] as const

/**
 * Guarda en el catálogo propio un producto que viene de Open Food Facts (búsqueda) si aún no está.
 * Necesario antes de referenciarlo desde un registro o un plato.
 */
export async function ensureCached(p: Product) {
  const row: Record<string, unknown> = { source: 'off' }
  for (const k of PRODUCT_COLUMNS) if ((p as any)[k] !== undefined) row[k] = (p as any)[k]
  const { error } = await supabase.from('products').upsert(row, { onConflict: 'barcode', ignoreDuplicates: true })
  if (error) throw error
}

export async function saveManualProduct(p: Omit<Product, 'barcode'> & { barcode?: string }) {
  const barcode = p.barcode?.trim() || `manual-${crypto.randomUUID().slice(0, 8)}`
  const row = { ...p, barcode, source: 'manual' }
  const { error } = await supabase.from('products').insert(row)
  if (error) throw error
  return row as Product
}

export type RecentProduct = Product & { lastGrams: number; mine: boolean; eatenBy: string[] }

/**
 * Histórico compartido: productos usados recientemente por cualquiera de los dos (sin duplicados).
 * La cantidad sugerida es la propia más reciente; `mine` = false si solo lo ha comido el otro.
 */
export async function recentProducts(limit = 60): Promise<RecentProduct[]> {
  const { data: recent, error } = await supabase.rpc('shared_recent_products', { p_limit: limit })
  if (error || !recent?.length) return []
  const codes = (recent as any[]).map((r) => r.barcode)
  const { data: products } = await supabase.from('products').select('*').in('barcode', codes)
  const byCode = new Map(((products ?? []) as Product[]).map((p) => [p.barcode, p]))
  return (recent as any[]).flatMap((r) => {
    const p = byCode.get(r.barcode)
    return p ? [{ ...p, lastGrams: Number(r.last_grams), mine: Boolean(r.mine), eatenBy: (r.eaten_by ?? []) as string[] }] : []
  })
}

export function macrosFor(p: Product, grams: number) {
  const f = grams / 100
  return {
    kcal: Number(p.kcal_100g ?? 0) * f,
    protein: Number(p.protein_100g ?? 0) * f,
    carbs: Number(p.carbs_100g ?? 0) * f,
    fat: Number(p.fat_100g ?? 0) * f,
  }
}

/** Corrige si un producto va por 100 g o por 100 ml (catálogo compartido) */
export async function setProductUnit(barcode: string, unit: 'g' | 'ml') {
  const { error } = await supabase.rpc('set_product_unit', { p_barcode: barcode, p_unit: unit })
  if (error) throw error
}
