import { ChefHat, ChevronDown, Save, Scale } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NumInput, r0, r1, toast } from './ui'
import { UNITS, dishTotals, loadDish, saveDish, toGrams, type DishDraft } from '../lib/dishes'
import { macrosFor } from '../lib/food'
import type { Product } from '../lib/types'

const unitLabel = (u: string) => (u === 'g' || u === 'ml' ? u : UNITS.find((x) => x.id === u)?.label ?? u)

/**
 * Composición de un plato: ingredientes y cantidades, editables.
 * Al guardar se recalculan las kcal y macros por 100 g del plato.
 */
export default function DishComposition({ dish, onUpdated, defaultOpen = false }: {
  dish: Product
  onUpdated: (p: Product) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [saved, setSaved] = useState<DishDraft | null>(null)
  const [d, setD] = useState<DishDraft | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadDish(dish).then((x) => { setSaved(x); setD(x) }).catch(() => setD(null))
  }, [dish.barcode])

  const t = useMemo(() => (d ? dishTotals(d.items, d.cookedGrams) : null), [d])
  const dirty = !!d && !!saved && (
    d.cookedGrams !== saved.cookedGrams || d.items.some((it, i) => it.amount !== saved.items[i]?.amount))

  async function save() {
    if (!d) return
    setBusy(true)
    try {
      const p = await saveDish(d)
      setSaved(d)
      toast(`Plato actualizado · ${r0(p.kcal_100g)} kcal/100 g`)
      onUpdated({ ...dish, ...p })
    } catch (e: any) { toast.err(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="card composition" style={{ padding: 12 }}>
      <button type="button" className="composition-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChefHat size={15} color="var(--amber)" />
        <span className="grow">Composición{d ? ` · ${d.items.length} ingredientes` : ''}</span>
        {dirty && <span className="tag" style={{ color: 'var(--amber)' }}>sin guardar</span>}
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
      </button>

      {open && (!d || !t ? <div className="empty"><span className="spin" /></div> : (
        <div className="stack" style={{ gap: 10, marginTop: 10 }}>
          {!d.items.length && <div className="small muted">Este plato no tiene ingredientes guardados.</div>}
          {d.items.map((it, i) => {
            const g = toGrams(it.amount, it.unit, it.product)
            return (
              <div key={i} className="row comp-row">
                <div className="grow">
                  <div className="ellipsis">{it.product.name}</div>
                  <div className="small muted mono">{it.unit !== 'g' ? `${r0(g)} g · ` : ''}{r0(macrosFor(it.product, g).kcal)} kcal</div>
                </div>
                <NumInput className="mono comp-amount" value={it.amount} aria-label={`Cantidad de ${it.product.name}`}
                  onChange={(v) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)) })} />
                <span className="small muted comp-unit">{unitLabel(it.unit)}</span>
              </div>
            )
          })}
          <div className="row comp-row">
            <div className="grow small muted ic"><Scale size={13} /> Peso final cocinado</div>
            <NumInput className="mono comp-amount" value={d.cookedGrams} placeholder={String(r0(t.rawGrams))}
              onChange={(v) => setD({ ...d, cookedGrams: v })} aria-label="Peso final cocinado" />
            <span className="small muted comp-unit">g</span>
          </div>
          <div className="small mono muted">
            Por 100 g: <b style={{ color: 'var(--text)' }}>{r0(t.per100.kcal)} kcal</b> · P{r1(t.per100.protein)} C{r1(t.per100.carbs)} G{r1(t.per100.fat)}
            <span className="faint"> · olla {r0(t.kcal)} kcal / {r0(t.finalGrams)} g</span>
          </div>
          {dirty && (
            <>
              <span className="small faint">
                Al guardar cambia la receta: las kcal por 100 g del plato se recalculan para próximos registros. Lo ya registrado no cambia.
              </span>
              <div className="grid2">
                <button type="button" className="btn-ghost" onClick={() => setD(saved)}>Descartar</button>
                <button type="button" className="btn-primary" disabled={busy} onClick={save}>
                  {busy ? <span className="spin" /> : <><Save size={16} /> Guardar plato</>}
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
