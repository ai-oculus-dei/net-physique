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
const FIELDS = 'code,product_name,product_name_es,brands,image_front_small_url,nutriments,serving_quantity'

type Off = Record<string, any>

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

  if (q) {
    const { data: cached } = await supabase.rpc('search_products', { q })
    const r = await fetch(
      `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&langs=es,en&page_size=20&fields=${FIELDS}`,
      { headers: { 'User-Agent': UA } },
    ).catch(() => null)
    let remote: ReturnType<typeof toRow>[] = []
    if (r?.ok) {
      const body = await r.json()
      remote = (body.hits ?? []).filter((h: Off) => h.code && h.nutriments).map(toRow)
    }
    const seen = new Set((cached ?? []).map((p: any) => p.barcode))
    return json({ products: [...(cached ?? []), ...remote.filter((p) => !seen.has(p.barcode))], source: 'mixed' })
  }

  return json({ error: 'barcode o q requerido' }, 400)
})
