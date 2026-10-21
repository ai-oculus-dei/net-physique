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

export async function searchProducts(q: string): Promise<Product[]> {
  if (/^\d{8,14}$/.test(q)) {
    const p = await lookupBarcode(q)
    return p ? [p] : []
  }
  return invoke({ q })
}

/** Guarda un producto de búsqueda remota en la caché al usarlo */
export async function ensureCached(p: Product) {
  await supabase.from('products').upsert(
    { ...p, source: p.source ?? 'off' },
    { onConflict: 'barcode', ignoreDuplicates: true },
  )
}

export async function saveManualProduct(p: Omit<Product, 'barcode'> & { barcode?: string }) {
  const barcode = p.barcode?.trim() || `manual-${crypto.randomUUID().slice(0, 8)}`
  const row = { ...p, barcode, source: 'manual' }
  const { error } = await supabase.from('products').insert(row)
  if (error) throw error
  return row as Product
}

export type RecentProduct = Product & { lastGrams: number; mine: boolean }

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
    return p ? [{ ...p, lastGrams: Number(r.last_grams), mine: Boolean(r.mine) }] : []
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
