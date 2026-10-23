import { ChefHat, History, Users, Package, PenLine, Pencil, Plus, ScanBarcode, Search, SearchX, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import BarcodeScanner from './BarcodeScanner'
import DishComposition from './DishComposition'
import DishEditor from './DishEditor'
import { decimalText, Empty, Seg, Sheet, num, r0, r1, toast } from './ui'
import { fuzzyFilter } from '../lib/search'
import { ensureCached, lookupBarcode, type RecentProduct, macrosFor, recentProducts, saveManualProduct, searchProducts, setProductUnit } from '../lib/food'
import { unitOf, type FoodUnit } from '../lib/units'
import { listDishes } from '../lib/dishes'
import { ymd } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { MEALS, isDish, type Meal, type Product } from '../lib/types'

type Tab = 'history' | 'dishes' | 'scan' | 'search' | 'manual'

export default function AddFood({ open, meal, day, onClose, onSaved, initialProduct = null }: {
  open: boolean; meal: Meal; day: string; onClose: () => void; onSaved: () => void
  /** abrir directamente en "Registrar" con este producto (p. ej. un plato recién creado) */
  initialProduct?: Product | null
}) {
  const [picked, setPicked] = useState<Product | null>(null)
  const [defaultGrams, setDefaultGrams] = useState<number | null>(null)

  useEffect(() => { if (open) setPicked(initialProduct) }, [open, initialProduct])

  const pick = (p: Product, grams?: number) => { setPicked(p); setDefaultGrams(grams ?? null) }

  return (
    <Sheet open={open} onClose={picked ? () => setPicked(null) : onClose} title={picked ? 'Registrar' : 'Añadir alimento'}>
      {picked ? (
        <PortionForm product={picked} meal={meal} day={day} defaultGrams={defaultGrams}
          onBack={() => setPicked(null)} onSaved={onSaved} />
      ) : (
        <ProductPicker onPick={pick} withDishes key={String(open)} />
      )}
    </Sheet>
  )
}

/** Selector de producto reutilizable (registro de comida e ingredientes de platos) */
export function ProductPicker({ onPick, withDishes = false, initialTab = 'history' }: {
  onPick: (p: Product, grams?: number) => void; withDishes?: boolean; initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const tabs = [
    { id: 'history' as Tab, label: <span className="ic"><History size={14} /> Histórico</span> },
    ...(withDishes ? [{ id: 'dishes' as Tab, label: <span className="ic"><ChefHat size={14} /> Platos</span> }] : []),
    { id: 'scan' as Tab, label: <span className="ic"><ScanBarcode size={14} /> Escanear</span> },
    { id: 'search' as Tab, label: <span className="ic"><Search size={14} /> Buscar</span> },
    { id: 'manual' as Tab, label: <span className="ic"><PenLine size={14} /> Manual</span> },
  ]
  return (
    <div className="stack">
      <Seg variant="tabs" value={tab} onChange={setTab} options={tabs} />
      {tab === 'scan' && <ScanTab onPick={onPick} onManual={() => setTab('manual')} />}
      {tab === 'search' && <SearchTab onPick={onPick} />}
      {tab === 'history' && <HistoryTab onPick={onPick} />}
      {tab === 'dishes' && <DishesTab onPick={onPick} />}
      {tab === 'manual' && <ManualTab onPick={onPick} />}
    </div>
  )
}

export function DishTag() {
  return <span className="tag dish-tag"><ChefHat size={11} /> Plato cocinado</span>
}

function ProductRow({ p, onClick, extra, action, shared }: { p: Product; onClick: () => void; extra?: string; action?: React.ReactNode; shared?: boolean }) {
  const dish = isDish(p)
  return (
    <div className="list-item" onClick={onClick} style={{ cursor: 'pointer' }}>
      {p.image_url ? <img className="thumb" src={p.image_url} alt="" loading="lazy" />
        : <div className={`thumb ${dish ? 'dish' : ''}`}>{dish ? <ChefHat size={20} /> : <Package size={20} />}</div>}
      <div className="grow">
        <div className="ellipsis">{p.name}</div>
        <div className="small muted ellipsis">
          {shared && <Users size={11} className="shared-ico" aria-label="Lo ha comido tu pareja" />}
          {dish ? <DishTag /> : p.brand ?? '—'}{extra ? ` · ${extra}` : ''}
        </div>
      </div>
      <div className="mono small" style={{ textAlign: 'right' }}>
        {r0(p.kcal_100g)}<div className="faint tiny">kcal/100{unitOf(p)}</div>
      </div>
      {action}
    </div>
  )
}

function ScanTab({ onPick, onManual }: { onPick: (p: Product) => void; onManual: () => void }) {
  const [state, setState] = useState<'scan' | 'loading' | 'missing'>('scan')
  const [code, setCode] = useState('')
  const onDetect = useCallback(async (c: string) => {
    setCode(c); setState('loading')
    try {
      const p = await lookupBarcode(c)
      if (p) onPick(p)
      else setState('missing')
    } catch { setState('missing') }
  }, [onPick])
  if (state === 'loading') return <div className="empty"><span className="spin" /> Buscando {code}…</div>
  if (state === 'missing') return (
    <div className="stack">
      <Empty icon={SearchX}>No se encontró <span className="mono">{code}</span> ni en caché ni en Open Food Facts.</Empty>
      <div className="grid2">
        <button onClick={() => setState('scan')}>Reintentar</button>
        <button className="btn-primary" onClick={onManual}>Crear manual</button>
      </div>
    </div>
  )
  return <BarcodeScanner onDetect={onDetect} />
}

function SearchTab({ onPick }: { onPick: (p: Product) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Product[] | null>(null)
  const [busy, setBusy] = useState(false)
  async function go(e: React.FormEvent) {
    e.preventDefault()
    if (q.trim().length < 2) return
    setBusy(true)
    try { setRes(await searchProducts(q.trim())) } catch { toast.err('Error en la búsqueda'); setRes([]) }
    setBusy(false)
  }
  return (
    <div className="stack">
      <form className="row" onSubmit={go}>
        <input className="grow" placeholder="Nombre, marca o código de barras" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <button className="btn-primary" disabled={busy}>{busy ? <span className="spin" /> : <Search size={18} />}</button>
      </form>
      {res && res.length === 0 && <Empty icon={SearchX}>Sin resultados</Empty>}
      <div className="list">
        {res?.map((p) => <ProductRow key={p.barcode} p={p} onClick={() => onPick(p)} />)}
      </div>
      <p className="faint small" style={{ margin: 0 }}>Primero busca en vuestra base de datos; después en Open Food Facts.</p>
    </div>
  )
}

function HistoryTab({ onPick }: { onPick: (p: Product, g?: number) => void }) {
  const [list, setList] = useState<RecentProduct[] | null>(null)
  const [f, setF] = useState('')
  useEffect(() => { recentProducts().then(setList) }, [])
  if (!list) return <div className="empty"><span className="spin" /></div>
  if (!list.length) return <Empty icon={History}>Aún no hay histórico. Escanea o busca tu primer producto.</Empty>
  const shown = fuzzyFilter(list, f, (p) => `${p.name} ${p.brand ?? ''}`, (p) => p.name)
  return (
    <div className="stack">
      <input placeholder="Buscar en el histórico (de los dos)…" value={f} onChange={(e) => setF(e.target.value)} />
      <div className="list">
        {shown.map((p) => <ProductRow key={p.barcode} p={p} extra={`últ. ${r0(p.lastGrams)} ${unitOf(p)}`}
          shared={!p.mine} onClick={() => onPick(p, p.lastGrams)} />)}
      </div>
    </div>
  )
}

/** Platos cocinados: elegir para registrar, crear o editar */
function DishesTab({ onPick }: { onPick: (p: Product) => void }) {
  const [list, setList] = useState<Product[] | null>(null)
  const [f, setF] = useState('')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const load = () => listDishes().then(setList)
  useEffect(() => { load() }, [])

  const shown = fuzzyFilter(list ?? [], f, (p) => p.name)
  return (
    <div className="stack">
      <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={17} /> Crear plato</button>
      {list && list.length > 4 && <input placeholder="Filtrar platos…" value={f} onChange={(e) => setF(e.target.value)} />}
      {!list && <div className="empty"><span className="spin" /></div>}
      {list && !list.length && (
        <Empty icon={ChefHat}>Aún no hay platos. Crea uno con sus ingredientes y se calcularán las kcal por 100 g.</Empty>
      )}
      <div className="list">
        {shown.map((p) => (
          <ProductRow key={p.barcode} p={p} onClick={() => onPick(p)}
            action={
              <button className="btn-icon btn-ghost" aria-label="Editar plato"
                onClick={(e) => { e.stopPropagation(); setEditing(p) }}><Pencil size={16} /></button>
            } />
        ))}
      </div>
      {editing && (
        <DishEditor dish={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={(p, eatNow) => { setEditing(null); load(); if (eatNow) onPick(p) }}
          onDeleted={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}

export function ManualTab({ onPick }: { onPick: (p: Product) => void }) {
  const [v, setV] = useState<Record<string, string>>({})
  const [unit, setUnit] = useState<FoodUnit>('g')
  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: e.target.value }))
  // campos numéricos: coma → punto
  const sd = (k: string, decimal = true) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: decimalText(e.target.value, { decimal }) }))
  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      const p = await saveManualProduct({
        barcode: v.barcode, name: v.name, brand: v.brand || null, image_url: null,
        kcal_100g: num(v.kcal ?? ''), protein_100g: num(v.protein ?? ''), carbs_100g: num(v.carbs ?? ''),
        fat_100g: num(v.fat ?? ''), serving_g: num(v.serving ?? ''), unit,
      })
      toast('Producto guardado')
      onPick(p)
    } catch (err: any) { toast.err(err.message) }
  }
  return (
    <form className="stack" onSubmit={save}>
      <label className="field"><span>Nombre *</span><input required value={v.name ?? ''} onChange={s('name')} /></label>
      <div className="grid2">
        <label className="field"><span>Marca</span><input value={v.brand ?? ''} onChange={s('brand')} /></label>
        <label className="field"><span>Código de barras</span><input inputMode="numeric" value={v.barcode ?? ''} onChange={sd('barcode', false)} /></label>
      </div>
      <div className="row between">
        <span className="tiny muted">Valores por</span>
        <Seg value={unit} onChange={setUnit} options={[{ id: 'g', label: '100 g' }, { id: 'ml', label: '100 ml (líquido)' }]} />
      </div>
      <div className="grid2">
        <label className="field"><span>kcal *</span><input required inputMode="decimal" value={v.kcal ?? ''} onChange={sd('kcal')} /></label>
        <label className="field"><span>Proteína g</span><input inputMode="decimal" value={v.protein ?? ''} onChange={sd('protein')} /></label>
        <label className="field"><span>Carbohidratos g</span><input inputMode="decimal" value={v.carbs ?? ''} onChange={sd('carbs')} /></label>
        <label className="field"><span>Grasas g</span><input inputMode="decimal" value={v.fat ?? ''} onChange={sd('fat')} /></label>
      </div>
      <label className="field"><span>Ración habitual ({unit})</span><input inputMode="decimal" value={v.serving ?? ''} onChange={sd('serving')} /></label>
      <button className="btn-primary">Guardar producto</button>
    </form>
  )
}

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function PortionForm({ product: product0, meal: meal0, day, defaultGrams, onBack, onSaved }: {
  product: Product; meal: Meal; day: string; defaultGrams: number | null; onBack: () => void; onSaved: () => void
}) {
  // los platos pueden actualizarse desde su composición: se recalculan los macros de la ración
  const [product, setProduct] = useState(product0)
  // la cantidad sugerida (última vez, ración o 100 g) se muestra en gris; se usa si no se escribe nada
  const suggested = Number(defaultGrams ?? product.serving_g ?? 100)
  const [grams, setGrams] = useState('')
  const [meal, setMeal] = useState<Meal>(meal0)
  const [time, setTime] = useState(nowTime())
  const [busy, setBusy] = useState(false)
  const g = num(grams) ?? suggested
  const m = macrosFor(product, g)
  const dish = isDish(product)
  const unit = unitOf(product)

  async function changeUnit(u: FoodUnit) {
    if (u === unit) return
    try {
      await setProductUnit(product.barcode, u)
      setProduct({ ...product, unit: u })
      toast(u === 'ml' ? 'Este producto va por 100 ml' : 'Este producto va por 100 g')
    } catch (e: any) { toast.err(e.message) }
  }

  async function save() {
    setBusy(true)
    if (!dish) await ensureCached(product)
    const eaten = new Date(`${day}T${time}:00`)
    const { error } = await supabase.from('food_logs').insert({
      day, meal, eaten_at: eaten.toISOString(), barcode: product.barcode, name: product.name, grams: g, unit, ...m,
    })
    setBusy(false)
    if (error) return toast.err(error.message)
    toast(`${r0(m.kcal)} kcal en ${MEALS.find((x) => x.id === meal)?.label}`)
    onSaved()
  }

  return (
    <div className="stack">
      <div className="row">
        {product.image_url ? <img className="thumb" src={product.image_url} alt="" />
          : <div className={`thumb ${dish ? 'dish' : ''}`}>{dish ? <ChefHat size={20} /> : <Package size={20} />}</div>}
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{product.name}</div>
          <div className="small muted">
            {dish ? <DishTag /> : <>{product.brand ?? ''} <span className="tag">{product.barcode.startsWith('manual') ? 'manual' : product.barcode}</span></>}
          </div>
        </div>
      </div>
      <div className="grid3">
        <label className="field" style={{ gridColumn: 'span 2' }}><span>Cantidad ({unit})</span>
          <input className="mono" inputMode="decimal" value={grams} placeholder={String(suggested)}
            onChange={(e) => setGrams(decimalText(e.target.value))} autoFocus />
        </label>
        <label className="field"><span>Hora</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <div className="chips">
        {[product.serving_g, 50, 100, 150, 200].filter((x, i, a) => x && a.indexOf(x) === i).map((x) => (
          <button key={x} className={`chip ${g === x ? 'on' : ''}`} onClick={() => setGrams(String(x))}>{x} {unit}{x === product.serving_g ? ' (ración)' : ''}</button>
        ))}
      </div>
      <div className="chips">
        {MEALS.map((x) => <button key={x.id} className={`chip ${meal === x.id ? 'on' : ''}`} onClick={() => setMeal(x.id)}><x.icon size={14} /> {x.label}</button>)}
      </div>
      <div className="card grid3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', padding: 12 }}>
        <div className="kpi"><span className="v" style={{ fontSize: 18 }}>{r0(m.kcal)}</span><span className="l">kcal</span></div>
        <div className="kpi"><span className="v" style={{ fontSize: 18, color: 'var(--protein)' }}>{r1(m.protein)}</span><span className="l">Prot</span></div>
        <div className="kpi"><span className="v" style={{ fontSize: 18, color: 'var(--carbs)' }}>{r1(m.carbs)}</span><span className="l">Carb</span></div>
        <div className="kpi"><span className="v" style={{ fontSize: 18, color: 'var(--fat)' }}>{r1(m.fat)}</span><span className="l">Grasa</span></div>
      </div>
      {!dish && (
        <div className="row between small">
          <span className="muted">Valores nutricionales por</span>
          <Seg value={unit} onChange={changeUnit} options={[{ id: 'g', label: '100 g' }, { id: 'ml', label: '100 ml' }]} />
        </div>
      )}
      {product.kcal_100g == null && <div className="small warn ic"><TriangleAlert size={14} /> Este producto no tiene kcal en Open Food Facts.</div>}
      <div className="grid2">
        <button className="btn-ghost" onClick={onBack}>‹ Volver</button>
        <button className="btn-primary" onClick={save} disabled={busy || g <= 0}>{busy ? <span className="spin" /> : 'Registrar'}</button>
      </div>
      {day !== ymd() && <div className="small faint">Se registrará en {day}</div>}
      {dish && <DishComposition dish={product} onUpdated={setProduct} defaultOpen />}
    </div>
  )
}
