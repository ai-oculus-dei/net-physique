import { CalendarRange, ChefHat, Check, ListChecks, Package, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DishTag } from './AddFood'
import { NumInput, Sheet, r0, toast } from './ui'
import { listDishes } from '../lib/dishes'
import { ensureCached, macrosFor, recentProducts } from '../lib/food'
import { projectPlan, suggestedGrams, type Macros, type PlanItem } from '../lib/planner'
import { supabase } from '../lib/supabase'
import { MEALS, isDish, type Meal, type Product } from '../lib/types'
import { unitOf } from '../lib/units'
import { fuzzyFilter } from '../lib/search'

type Candidate = Product & { lastGrams?: number }
type Kind = 'all' | 'dish' | 'food'
interface Item extends PlanItem { suggested: number }

const planKey = (day: string) => `np-plan-${day}`
function loadPlan(day: string): Item[] {
  try { return JSON.parse(localStorage.getItem(planKey(day)) ?? '[]') } catch { return [] }
}
function savePlan(day: string, items: Item[]) {
  try { items.length ? localStorage.setItem(planKey(day), JSON.stringify(items)) : localStorage.removeItem(planKey(day)) } catch { /* sin storage */ }
}

const MACROS = [
  { k: 'kcal' as const, label: 'Calorías', unit: 'kcal', color: 'var(--cyan)' },
  { k: 'protein' as const, label: 'Proteína', unit: 'g', color: 'var(--protein)' },
  { k: 'carbs' as const, label: 'Carbohidratos', unit: 'g', color: 'var(--carbs)' },
  { k: 'fat' as const, label: 'Grasas', unit: 'g', color: 'var(--fat)' },
]

/** Barra apilada: consumido (sólido) + planificado (rayado) frente al objetivo */
function StackBar({ consumed, planned, target, color }: { consumed: number; planned: number; target: number; color: string }) {
  const scale = Math.max(target, consumed + planned, 1)
  const c = (consumed / scale) * 100
  const p = (planned / scale) * 100
  const t = (target / scale) * 100
  return (
    <div className="stackbar">
      <i className="c" style={{ width: `${c}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      <i className="p" style={{ left: `${c}%`, width: `${p}%`, ['--col' as string]: color }} />
      {t < 100 && <b className="goal" style={{ left: `${t}%` }} />}
    </div>
  )
}

export default function Planner({ open, onClose, day, consumed, target, onLogged }: {
  open: boolean; onClose: () => void; day: string; consumed: Macros; target: Macros | null; onLogged: () => void
}) {
  const [cands, setCands] = useState<Candidate[] | null>(null)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const [items, setItems] = useState<Item[]>(() => loadPlan(day))
  const [meal, setMeal] = useState<Meal>('comida')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setItems(loadPlan(day)) }, [day])
  useEffect(() => { savePlan(day, items) }, [day, items])
  useEffect(() => {
    if (!open) return
    // histórico + todos los platos (aunque aún no se hayan comido)
    Promise.all([recentProducts(150), listDishes()]).then(([recent, dishes]) => {
      const seen = new Set(recent.map((p) => p.barcode))
      setCands([...recent, ...dishes.filter((d) => !seen.has(d.barcode))])
    }).catch(() => setCands([]))
  }, [open])

  const tgt = target ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  const proj = useMemo(() => projectPlan(consumed, items, tgt), [consumed, items, tgt])
  const inPlan = new Set(items.map((i) => i.product.barcode))

  const shown = fuzzyFilter((cands ?? []).filter((p) => kind === 'all' || (kind === 'dish') === isDish(p)),
    q, (p) => `${p.name} ${p.brand ?? ''}`, (p) => p.name)

  function add(p: Candidate) {
    const g = suggestedGrams(p)
    setItems((o) => [...o, { product: p, grams: g, suggested: g }])
  }
  const setGrams = (i: number, g: number | null) =>
    setItems((o) => o.map((it, j) => (j === i ? { ...it, grams: g ?? it.suggested } : it)))

  async function logAll() {
    if (!items.length) return
    setBusy(true)
    try {
      const now = new Date()
      const eaten = new Date(`${day}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`)
      for (const it of items) if (!isDish(it.product)) await ensureCached(it.product)
      const { error } = await supabase.from('food_logs').insert(items.map((it) => ({
        day, meal, eaten_at: eaten.toISOString(), barcode: it.product.barcode, name: it.product.name,
        grams: it.grams, unit: unitOf(it.product), ...macrosFor(it.product, it.grams),
      })))
      if (error) throw error
      toast(`${items.length} alimentos registrados en ${MEALS.find((m) => m.id === meal)?.label}`)
      setItems([])
      onLogged()
    } catch (e: any) { toast.err(e.message) } finally { setBusy(false) }
  }

  const left = proj.remaining.kcal
  return (
    <Sheet open={open} onClose={onClose} title={<span className="ic"><CalendarRange size={18} color="var(--cyan)" /> Planificador</span>}>
      <div className="stack">
        {/* Proyección */}
        <div className="card glow" style={{ padding: 12 }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Cómo quedaría el día</h2>
            <span className={`mono small ${left < 0 ? 'warn' : ''}`}>
              {left >= 0 ? `quedan ${r0(left)} kcal` : `+${r0(-left)} kcal sobre objetivo`}
            </span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {MACROS.map((m) => (
              <div key={m.k} className="stack" style={{ gap: 5 }}>
                <div className="row between small">
                  <span>{m.label}</span>
                  <span className="mono">
                    <span className="muted">{r0(proj.consumed[m.k])}</span>
                    {proj.planned[m.k] > 0 && <span style={{ color: m.color }}> +{r0(proj.planned[m.k])}</span>}
                    <span className="muted"> / {r0(proj.target[m.k])} {m.unit}</span>
                  </span>
                </div>
                <StackBar consumed={proj.consumed[m.k]} planned={proj.planned[m.k]} target={proj.target[m.k]} color={m.color} />
              </div>
            ))}
          </div>
          <div className="tiny faint" style={{ marginTop: 8 }}>
            <span className="legend-solid" /> ya consumido · <span className="legend-striped" /> planificado · <span className="legend-goal" /> objetivo
          </div>
        </div>

        {/* Plan */}
        {items.length > 0 && (
          <div className="card" style={{ padding: 12 }}>
            <div className="row between">
              <h2 style={{ margin: 0 }}><ListChecks size={14} /> Preselección ({items.length})</h2>
              <button className="btn-sm btn-ghost" onClick={() => setItems([])}><Trash2 size={14} /> Vaciar</button>
            </div>
            <div className="list" style={{ marginTop: 6 }}>
              {items.map((it, i) => {
                const m = macrosFor(it.product, it.grams)
                return (
                  <div key={i} className="list-item">
                    <div className="grow">
                      <div className="ellipsis">{isDish(it.product) && <ChefHat size={13} color="var(--amber)" style={{ marginRight: 4, verticalAlign: -1 }} />}{it.product.name}</div>
                      <div className="small muted mono">{r0(m.kcal)} kcal · P{r0(m.protein)} C{r0(m.carbs)} G{r0(m.fat)}</div>
                    </div>
                    <NumInput className="mono plan-grams" value={it.grams} fallback={it.suggested} fallbackAsPlaceholder={it.grams === it.suggested}
                      onChange={(g) => setGrams(i, g)} aria-label="Gramos" />
                    <span className="small muted">{unitOf(it.product)}</span>
                    <button className="btn-icon btn-ghost" aria-label="Quitar" onClick={() => setItems(items.filter((_, j) => j !== i))}><X size={16} /></button>
                  </div>
                )
              })}
            </div>
            <div className="chips" style={{ marginTop: 10 }}>
              {MEALS.map((x) => <button key={x.id} className={`chip ${meal === x.id ? 'on' : ''}`} onClick={() => setMeal(x.id)}><x.icon size={14} /> {x.label}</button>)}
            </div>
            <button className="btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={logAll}>
              {busy ? <span className="spin" /> : <><Check size={17} /> Registrar preselección</>}
            </button>
          </div>
        )}

        {/* Buscador del histórico */}
        <input placeholder="Buscar en el histórico y en los platos…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {([['all', 'Todo'], ['dish', 'Platos'], ['food', 'Alimentos']] as [Kind, string][]).map(([id, l]) => (
            <button key={id} className={`chip ${kind === id ? 'on' : ''}`} onClick={() => setKind(id)}>{l}</button>
          ))}
        </div>
        {!cands && <div className="empty"><span className="spin" /></div>}
        {cands && !shown.length && <div className="empty small">Nada en el histórico con ese nombre.</div>}
        <div className="list">
          {shown.map((p) => {
            const g = suggestedGrams(p)
            const kcal = macrosFor(p, g).kcal
            const added = inPlan.has(p.barcode)
            return (
              <div key={p.barcode} className="list-item" onClick={() => add(p)} style={{ cursor: 'pointer' }}>
                <div className={`thumb ${isDish(p) ? 'dish' : ''}`}>{isDish(p) ? <ChefHat size={20} /> : <Package size={20} />}</div>
                <div className="grow">
                  <div className="ellipsis">{p.name}</div>
                  <div className="small muted ellipsis">{isDish(p) ? <DishTag /> : p.brand ?? '—'}</div>
                </div>
                <div className="mono small" style={{ textAlign: 'right' }}>
                  <span className={target && kcal > left ? 'warn' : ''}>{r0(kcal)}</span>
                  <div className="faint tiny">{r0(g)} {unitOf(p)}</div>
                </div>
                <button className={`btn-icon ${added ? 'btn-ghost' : ''}`} aria-label="Añadir al plan"
                  onClick={(e) => { e.stopPropagation(); add(p) }}>
                  {added ? <Check size={17} color="var(--ok)" /> : <Plus size={17} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}
