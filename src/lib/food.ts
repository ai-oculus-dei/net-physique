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

/** Histórico: productos usados recientemente por el usuario (sin duplicados) */
export async function recentProducts(limit = 40): Promise<(Product & { lastGrams: number })[]> {
  const { data } = await supabase.from('food_logs').select('grams, eaten_at, products(*)')
    .not('barcode', 'is', null).order('eaten_at', { ascending: false }).limit(200)
  const seen = new Map<string, Product & { lastGrams: number }>()
  for (const r of (data ?? []) as any[]) {
    const p = r.products as Product | null
    if (p && !seen.has(p.barcode)) seen.set(p.barcode, { ...p, lastGrams: Number(r.grams) })
    if (seen.size >= limit) break
  }
  return [...seen.values()]
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
