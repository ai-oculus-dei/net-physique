// Edge Function: busca productos en caché (tabla products) y si no existen
// consulta Open Food Facts con User-Agent propio y los guarda.
//   GET ?barcode=3017620422003
//   GET ?q=yogur griego
import { createClient } from 'npm:@supabase/supabase-js@2'

const UA = Deno.env.get('OFF_USER_AGENT') ?? 'NetPhysique/1.0 (contact@example.com)'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const FIELDS = 'code,product_name,product_name_es,brands,image_front_small_url,nutriments,serving_quantity,serving_size,quantity,product_quantity_unit,serving_quantity_unit'

type Off = Record<string, any>

/** Los campos *_100g de OFF son "por 100 g o por 100 ml": la unidad sale de la cantidad del envase (= src/lib/units.ts) */
function detectUnit(p: Off): 'g' | 'ml' {
  const u = String(p.product_quantity_unit || p.serving_quantity_unit || '').toLowerCase().trim()
  if (u) return u === 'ml' || u === 'cl' || u === 'l' ? 'ml' : 'g'
  const text = `${p.quantity ?? ''} ${p.serving_size ?? ''}`.toLowerCase()
  return /\d\s*(ml|cl|dl|l|litros?)\b/.test(text) ? 'ml' : 'g'
}

function toRow(p: Off) {
  const n = p.nutriments ?? {}
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : null)
  return {
    barcode: String(p.code),
    name: p.product_name_es || p.product_name || 'Sin nombre',
    brand: Array.isArray(p.brands) ? p.brands.join(', ') : p.brands ?? null,
    image_url: p.image_front_small_url ?? null,
    kcal_100g: kcal,
    protein_100g: n.proteins_100g ?? null,
    carbs_100g: n.carbohydrates_100g ?? null,
    sugars_100g: n.sugars_100g ?? null,
    fat_100g: n.fat_100g ?? null,
    sat_fat_100g: n['saturated-fat_100g'] ?? null,
    fiber_100g: n.fiber_100g ?? null,
    salt_100g: n.salt_100g ?? null,
    serving_g: Number(p.serving_quantity) || null,
    unit: detectUnit(p),
    raw_json: p,
    source: 'off',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Cliente con el JWT del usuario: respeta RLS y rechaza anónimos
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  const url = new URL(req.url)
  const barcode = url.searchParams.get('barcode')?.trim()
  const q = url.searchParams.get('q')?.trim()

  if (barcode) {
    const { data: cached } = await supabase.from('products').select('*').eq('barcode', barcode).maybeSingle()
    if (cached) return json({ products: [cached], source: 'cache' })
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS}`,
      { headers: { 'User-Agent': UA } })
    if (!r.ok) return json({ products: [], source: 'off', status: r.status })
    const body = await r.json()
    if (body.status !== 1 || !body.product) return json({ products: [], source: 'off' })
    const row = toRow({ ...body.product, code: barcode })
    await supabase.from('products').upsert(row, { onConflict: 'barcode', ignoreDuplicates: true })
    return json({ products: [row], source: 'off' })
  }

  // texto + marca opcional + solo productos de España
  const brand = url.searchParams.get('brand')?.trim() ?? ''
  const spain = url.searchParams.get('es') === '1'
  if (q || brand) {
    // marca sin tildes ni comillas (el índice de OFF guarda las marcas normalizadas)
    const nb = brand.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/["\\]/g, '').trim()
    const lucene = [q, nb && `brands:"${nb}"`, spain && 'countries_tags:"en:spain"'].filter(Boolean).join(' ')

    // caché propia: por texto (o por la marca si no hay texto) y filtrando por marca
    const { data: cachedAll } = await supabase.rpc('search_products', { q: q || brand })
    const brandOk = (p: any) => !nb || String(p.brand ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nb)
    const cached = (cachedAll ?? []).filter(brandOk)

    const r = await fetch(
      `https://search.openfoodfacts.org/search?q=${encodeURIComponent(lucene)}&langs=es,en&page_size=25&fields=${FIELDS}`,
      { headers: { 'User-Agent': UA } },
    ).catch(() => null)
    let remote: ReturnType<typeof toRow>[] = []
    if (r?.ok) {
      const body = await r.json()
      remote = (body.hits ?? []).filter((h: Off) => h.code && h.nutriments).map(toRow)
    }
    const seen = new Set(cached.map((p: any) => p.barcode))
    return json({ products: [...cached, ...remote.filter((p) => !seen.has(p.barcode))], source: 'mixed' })
  }

  return json({ error: 'barcode o q requerido' }, 400)
})
