import { ChefHat, Plus, Scale, Trash2, TriangleAlert, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ProductPicker } from './AddFood'
import { NumInput, Sheet, r0, r1, toast } from './ui'
import { UNITS, deleteDish, dishTotals, loadDish, saveDish, toGrams, type DishDraft, type Unit } from '../lib/dishes'
import { macrosFor } from '../lib/food'
import type { Product } from '../lib/types'

/** cantidad por defecto de un ingrediente nuevo (en gris hasta que se escribe otra) */
const DEFAULT_AMOUNT = 100

export default function DishEditor({ dish, onClose, onSaved, onDeleted }: {
  dish: Product | null
  onClose: () => void
  onSaved: (p: Product, eatNow: boolean) => void
  onDeleted: () => void
}) {
  const [d, setD] = useState<DishDraft | null>(dish ? null : { name: '', cookedGrams: null, servingGrams: null, items: [] })
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (dish) loadDish(dish).then(setD).catch((e) => { toast.err(e.message); onClose() })
  }, [dish])

  const t = useMemo(() => (d ? dishTotals(d.items, d.cookedGrams) : null), [d])

  function addIngredient(p: Product) {
    setPicking(false)
    setD((o) => o && ({ ...o, items: [...o.items, { product: p, amount: DEFAULT_AMOUNT, unit: 'g', fresh: true }] }))
  }
  const setItem = (i: number, patch: Partial<{ amount: number; unit: Unit }>) =>
    setD((o) => o && ({ ...o, items: o.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }))

  async function save(eatNow: boolean) {
    if (!d) return
    if (!d.name.trim()) return toast.err('Ponle nombre al plato')
    if (!d.items.length) return toast.err('Añade al menos un ingrediente')
    setBusy(true)
    try {
      const p = await saveDish(d)
      toast(`Plato guardado · ${r0(p.kcal_100g)} kcal/100 g`)
      onSaved(p, eatNow)
    } catch (e: any) { toast.err(e.message) }
    setBusy(false)
  }

  async function remove() {
    if (!dish || !confirm(`¿Eliminar el plato "${dish.name}"? Los registros pasados se mantienen.`)) return
    try { await deleteDish(dish.barcode); toast('Plato eliminado'); onDeleted() } catch (e: any) { toast.err(e.message) }
  }

  return (
    <Sheet open onClose={picking ? () => setPicking(false) : onClose}
      title={<span className="ic"><ChefHat size={18} color="var(--cyan)" /> {dish ? 'Editar plato' : 'Nuevo plato'}</span>}>
      {!d || !t ? <div className="empty"><span className="spin" /></div> : (
        <div className="stack">
          <label className="field"><span>Nombre del plato</span>
            <input value={d.name} placeholder="Judías verdes con jamón" onChange={(e) => setD({ ...d, name: e.target.value })} />
          </label>

          <div className="card" style={{ padding: 12 }}>
            <h2>Ingredientes</h2>
            {!d.items.length && <p className="small muted" style={{ margin: '0 0 8px' }}>Añade cada ingrediente con la cantidad que echas a la olla.</p>}
            <div className="stack" style={{ gap: 10 }}>
              {d.items.map((it, i) => {
                const g = toGrams(it.amount, it.unit, it.product)
                const kcal = macrosFor(it.product, g).kcal
                return (
                  <div key={i} className="ingredient">
                    <div className="row">
                      <div className="grow">
                        <div className="ellipsis" style={{ fontWeight: 600 }}>{it.product.name}</div>
                        <div className="small muted mono">
                          {it.unit !== 'g' ? `${r0(g)} g · ` : ''}{r0(kcal)} kcal
                          {it.product.kcal_100g == null && <span className="warn"> · sin kcal</span>}
                        </div>
                      </div>
                      <button className="btn-icon btn-ghost" aria-label="Quitar ingrediente"
                        onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })}><X size={16} /></button>
                    </div>
                    <div className="grid2" style={{ marginTop: 6 }}>
                      <NumInput className="mono" value={it.amount} fallback={DEFAULT_AMOUNT} fallbackAsPlaceholder={!!it.fresh}
                        onChange={(v) => setItem(i, { amount: v ?? DEFAULT_AMOUNT })} aria-label="Cantidad" />
                      <select value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value as Unit })} aria-label="Unidad">
                        {UNITS.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.id === 'ud' ? `ración · ${r0(it.product.serving_g || 100)} g` : u.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
            <button style={{ marginTop: 10, width: '100%' }} onClick={() => setPicking(true)}><Plus size={17} /> Añadir ingrediente</button>
          </div>

          <div className="grid2">
            <label className="field"><span className="ic"><Scale size={13} /> Peso final cocinado (g)</span>
              <NumInput className="mono" value={d.cookedGrams} placeholder={r0(t.rawGrams) ? String(r0(t.rawGrams)) : 'opcional'}
                onChange={(v) => setD({ ...d, cookedGrams: v })} />
            </label>
            <label className="field"><span>Ración habitual (g)</span>
              <NumInput className="mono" value={d.servingGrams} placeholder="opcional" onChange={(v) => setD({ ...d, servingGrams: v })} />
            </label>
          </div>
          <span className="small faint" style={{ marginTop: -4 }}>
            Al cocinar se pierde agua: si pesas el plato terminado (sin el recipiente), las kcal por 100 g serán exactas.
            Si lo dejas vacío se usa la suma de ingredientes ({r0(t.rawGrams)} g).
          </span>

          <div className="card glow" style={{ padding: 12 }}>
            <h2>Por 100 g de plato</h2>
            <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="kpi"><span className="v" style={{ fontSize: 18 }}>{r0(t.per100.kcal)}</span><span className="l">kcal</span></div>
              <div className="kpi"><span className="v" style={{ fontSize: 18, color: 'var(--protein)' }}>{r1(t.per100.protein)}</span><span className="l">Prot</span></div>
              <div className="kpi"><span className="v" style={{ fontSize: 18, color: 'var(--carbs)' }}>{r1(t.per100.carbs)}</span><span className="l">Carb</span></div>
              <div className="kpi"><span className="v" style={{ fontSize: 18, color: 'var(--fat)' }}>{r1(t.per100.fat)}</span><span className="l">Grasa</span></div>
            </div>
            <div className="small muted mono" style={{ marginTop: 8 }}>
              Total olla: {r0(t.kcal)} kcal · {r0(t.finalGrams)} g{d.cookedGrams ? ` (crudo ${r0(t.rawGrams)} g)` : ''}
            </div>
          </div>
          {d.items.some((it) => it.product.kcal_100g == null) && (
            <div className="small warn ic"><TriangleAlert size={14} /> Algún ingrediente no tiene kcal: el cálculo se queda corto.</div>
          )}

          <div className="grid2">
            <button disabled={busy} onClick={() => save(false)}>Guardar</button>
            <button className="btn-primary" disabled={busy} onClick={() => save(true)}>{busy ? <span className="spin" /> : 'Guardar y registrar'}</button>
          </div>
          {dish && <button className="btn-danger" onClick={remove}><Trash2 size={16} /> Eliminar plato</button>}
        </div>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Añadir ingrediente">
        <ProductPicker onPick={(p) => addIngredient(p)} />
      </Sheet>
    </Sheet>
  )
}
