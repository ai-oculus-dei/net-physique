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

export type RecentProduct = Product & {
  /** última cantidad comida (null si solo se ha usado como ingrediente de platos) */
  lastGrams: number | null
  /** lo ha comido o usado en un plato el usuario actual */
  mine: boolean
  /** quiénes lo han comido */
  eatenBy: string[]
  /** se ha registrado como comido alguna vez */
  eaten: boolean
  /** platos en los que es ingrediente */
  inDishes: string[]
  /** quiénes crearon esos platos */
  dishCreators: string[]
  lastAt: string
}

/**
 * Histórico compartido: productos comidos por cualquiera de los dos + ingredientes de los platos (sin duplicados).
 * Los ingredientes no cuentan como comidos (no suman kcal): solo aparecen para tenerlos a mano.
 * La cantidad sugerida es la propia comida más reciente; para un ingrediente solo de platos, su ración o 100 g.
 */
export async function recentProducts(limit = 80): Promise<RecentProduct[]> {
  const [{ data: recent }, { data: ingredients }, { data: session }] = await Promise.all([
    supabase.rpc('shared_recent_products', { p_limit: limit }),
    supabase.from('dish_ingredients')
      .select('barcode, dish:products!dish_ingredients_dish_barcode_fkey(name, created_by, updated_at, created_at)')
      .not('barcode', 'is', null).limit(2000),
    supabase.auth.getSession(),
  ])
  const me = session.session?.user.id

  type Entry = Omit<RecentProduct, keyof Product>
  const byCode = new Map<string, Entry>()
  for (const r of (recent ?? []) as any[]) {
    byCode.set(r.barcode, {
      lastGrams: Number(r.last_grams), mine: Boolean(r.mine), eatenBy: r.eaten_by ?? [], eaten: true,
      inDishes: [], dishCreators: [], lastAt: r.last_at,
    })
  }
  for (const r of (ingredients ?? []) as any[]) {
    if (!r.dish || String(r.barcode).startsWith('dish-')) continue
    const at = r.dish.updated_at ?? r.dish.created_at
    const e: Entry = byCode.get(r.barcode) ?? {
      lastGrams: null, mine: false, eatenBy: [], eaten: false, inDishes: [], dishCreators: [], lastAt: at,
    }
    if (!e.inDishes.includes(r.dish.name)) e.inDishes.push(r.dish.name)
    if (r.dish.created_by && !e.dishCreators.includes(r.dish.created_by)) e.dishCreators.push(r.dish.created_by)
    if (r.dish.created_by === me) e.mine = true
    if (at > e.lastAt) e.lastAt = at
    byCode.set(r.barcode, e)
  }
  if (!byCode.size) return []

  const { data: products } = await supabase.from('products').select('*').in('barcode', [...byCode.keys()])
  return ((products ?? []) as Product[])
    .filter((p) => byCode.has(p.barcode))
    .map((p) => ({ ...p, ...byCode.get(p.barcode)! }))
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
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
