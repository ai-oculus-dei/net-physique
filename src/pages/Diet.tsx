import { Beef, CalendarRange, ChartNoAxesColumn, ChefHat, Droplet, Dumbbell, Flame, Footprints, Plus, Salad, ScanBarcode, Utensils, Wheat, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import AddFood from '../components/AddFood'
import BalanceCard from '../components/BalanceCard'
import Planner from '../components/Planner'
import DayPicker from '../components/DayPicker'
import { Bar, Empty, Ring, r0, toast } from '../components/ui'
import { hhmm, ymd } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { MEALS, type FoodLog, type Meal } from '../lib/types'
import { useDayEnergy } from '../lib/useDayEnergy'

/** Comida sugerida según la hora */
function mealForNow(): Meal {
  const h = new Date().getHours()
  if (h < 10) return 'desayuno'
  if (h < 12) return 'almuerzo'
  if (h < 16) return 'comida'
  if (h < 19) return 'merienda'
  if (h < 21) return 'picoteo'
  return 'cena'
}

export default function Diet() {
  const [day, setDay] = useState(ymd())
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [adding, setAdding] = useState<Meal | null>(null)
  const [planning, setPlanning] = useState(false)
  const { energy } = useDayEnergy(day)

  const load = useCallback(async () => {
    const { data } = await supabase.from('food_logs').select('*').eq('day', day).order('eaten_at')
    setLogs((data ?? []) as FoodLog[])
  }, [day])
  useEffect(() => { load() }, [load])

  const total = logs.reduce((a, l) => ({
    kcal: a.kcal + Number(l.kcal), protein: a.protein + Number(l.protein),
    carbs: a.carbs + Number(l.carbs), fat: a.fat + Number(l.fat),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  const target = energy?.kcal ?? 0
  const pct = target ? (total.kcal / target) * 100 : 0
  const left = target - total.kcal

  async function remove(id: number) {
    await supabase.from('food_logs').delete().eq('id', id)
    toast('Eliminado')
    load()
  }

  const macros = [
    { k: 'protein' as const, label: 'Proteína', color: 'var(--protein)', icon: Beef },
    { k: 'carbs' as const, label: 'Carbohidratos', color: 'var(--carbs)', icon: Wheat },
    { k: 'fat' as const, label: 'Grasas', color: 'var(--fat)', icon: Droplet },
  ]

  return (
    <div className="shell">
      <div className="topbar">
        <div>
          <h1><Salad size={22} /> Diet</h1>
          <div className="sub">{energy ? `TDEE ${r0(energy.tdee)} · déficit ${r0(energy.tdee - energy.kcal)}` : '…'}</div>
        </div>
        <DayPicker day={day} onChange={setDay} />
      </div>

      <div className="stack">
        {/* Balance de los 7 días anteriores (no depende del día elegido) */}
        <BalanceCard refreshKey={logs} />

        {/* Resumen calorías */}
        <div className="card glow">
          <h2><Flame size={14} /> Calorías consumidas / objetivo</h2>
          <div className="row" style={{ gap: 18 }}>
            <Ring value={total.kcal} max={target} size={150}>
              <span className="mono" style={{ fontSize: 26, fontWeight: 600 }}>{r0(pct)}<span className="muted" style={{ fontSize: 14 }}>%</span></span>
              <span className="tiny muted">del objetivo</span>
            </Ring>
            <div className="stack grow" style={{ gap: 10 }}>
              <div className="kpi">
                <span className="v">{r0(total.kcal)}<span className="muted" style={{ fontSize: 15 }}> / {r0(target)}</span></span>
                <span className="l">kcal</span>
              </div>
              <div className="kpi">
                <span className={`v ${left < 0 ? 'bad' : ''}`} style={{ fontSize: 18 }}>{left >= 0 ? r0(left) : '+' + r0(-left)}</span>
                <span className="l">{left >= 0 ? 'restantes' : 'excedidas'}</span>
              </div>
              {energy && (
                <div className="small muted mono row wrap" style={{ gap: 8 }}>
                  <span>basal {r0(energy.bmr)}{energy.factorUsed ? ` ×${energy.factorUsed}` : ''}</span>
                  <span className="ic"><Footprints size={12} /> {r0(energy.stepsKcal)}</span>
                  <span className="ic"><Dumbbell size={12} /> {r0(energy.trainingKcal)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Macros */}
        <div className="card">
          <h2><ChartNoAxesColumn size={14} /> Macronutrientes</h2>
          <div className="stack" style={{ gap: 14 }}>
            {macros.map((m) => {
              const t = energy?.[m.k] ?? 0
              const v = total[m.k]
              return (
                <div key={m.k} className="stack" style={{ gap: 6 }}>
                  <div className="row between small">
                    <span className="ic"><m.icon size={15} color={m.color} /> {m.label}</span>
                    <span className="mono"><b>{r0(v)}</b><span className="muted"> / {r0(t)} g · {t ? r0((v / t) * 100) : 0}%</span></span>
                  </div>
                  <Bar value={v} max={t} color={m.color} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Planificador: preselección de platos del histórico frente a los objetivos */}
        <button className="btn-block planner-btn" onClick={() => setPlanning(true)}>
          <CalendarRange size={18} /> Planificador
        </button>

        {/* Comidas */}
        {MEALS.map((m) => {
          const items = logs.filter((l) => l.meal === m.id)
          const kcal = items.reduce((a, l) => a + Number(l.kcal), 0)
          return (
            <div key={m.id} className="card">
              <div className="row between">
                <h2 style={{ margin: 0 }}><m.icon size={14} /> {m.label} {kcal > 0 && <span className="mono" style={{ color: 'var(--text)' }}>· {r0(kcal)} kcal</span>}</h2>
                <button className="btn-icon btn-ghost" onClick={() => setAdding(m.id)} aria-label="Añadir"><Plus size={18} /></button>
              </div>
              {items.length > 0 && (
                <div className="list" style={{ marginTop: 6 }}>
                  {items.map((l) => (
                    <div key={l.id} className="list-item">
                      <div className="grow">
                        <div className="ellipsis">{l.barcode?.startsWith('dish-') && <ChefHat size={13} color="var(--amber)" style={{ marginRight: 4, verticalAlign: -1 }} />}{l.name}</div>
                        <div className="small muted mono">{hhmm(l.eaten_at)} · {r0(l.grams)} g · P{r0(l.protein)} C{r0(l.carbs)} G{r0(l.fat)}</div>
                      </div>
                      <span className="mono">{r0(l.kcal)}</span>
                      <button className="btn-icon btn-ghost" onClick={() => remove(l.id)} aria-label="Eliminar"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {logs.length === 0 && <Empty icon={Utensils}>Nada registrado este día. Pulsa + en una comida.</Empty>}
      </div>

      <button className="btn-primary" onClick={() => setAdding(mealForNow())}
        style={{ position: 'fixed', right: 18, bottom: 'calc(96px + env(safe-area-inset-bottom))', borderRadius: 18, padding: '14px 18px', zIndex: 30, boxShadow: 'var(--glow)' }}>
        <ScanBarcode size={18} /> Añadir
      </button>

      <Planner open={planning} onClose={() => setPlanning(false)} day={day} consumed={total}
        target={energy ? { kcal: energy.kcal, protein: energy.protein, carbs: energy.carbs, fat: energy.fat } : null}
        onLogged={() => { setPlanning(false); load() }} />

      <AddFood open={adding !== null} meal={adding ?? 'comida'} day={day}
        onClose={() => setAdding(null)} onSaved={() => { setAdding(null); load() }} />
    </div>
  )
}
