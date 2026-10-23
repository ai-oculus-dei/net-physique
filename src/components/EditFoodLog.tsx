import { ChefHat, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NumInput, Sheet, r0, r1, toast } from './ui'
import { supabase } from '../lib/supabase'
import { MEALS, type FoodLog, type Meal } from '../lib/types'

const hhmmLocal = (ts: string) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Editar un registro de comida: cantidad, comida, hora y día.
 * Las kcal y macros se reescalan en proporción a la cantidad (se mantienen los valores del momento del registro).
 */
export default function EditFoodLog({ log, onClose, onSaved }: { log: FoodLog | null; onClose: () => void; onSaved: () => void }) {
  const [grams, setGrams] = useState<number | null>(null)
  const [meal, setMeal] = useState<Meal>('comida')
  const [time, setTime] = useState('12:00')
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!log) return
    setGrams(Number(log.grams)); setMeal(log.meal); setTime(hhmmLocal(log.eaten_at)); setDay(log.day)
  }, [log])

  if (!log) return null
  const unit = log.unit ?? 'g'
  const f = grams && Number(log.grams) > 0 ? grams / Number(log.grams) : 0
  const m = { kcal: log.kcal * f, protein: log.protein * f, carbs: log.carbs * f, fat: log.fat * f }
  const changed = grams !== Number(log.grams) || meal !== log.meal || time !== hhmmLocal(log.eaten_at) || day !== log.day

  async function save() {
    if (!log || !grams || grams <= 0) return
    setBusy(true)
    const { error } = await supabase.from('food_logs').update({
      grams, meal, day, eaten_at: new Date(`${day}T${time}:00`).toISOString(),
      kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
    }).eq('id', log.id)
    setBusy(false)
    if (error) return toast.err(error.message)
    toast('Registro actualizado')
    onSaved()
  }

  async function remove() {
    if (!log) return
    const { error } = await supabase.from('food_logs').delete().eq('id', log.id)
    if (error) return toast.err(error.message)
    toast('Eliminado')
    onSaved()
  }

  return (
    <Sheet open onClose={onClose} title="Editar registro">
      <div className="stack">
        <div style={{ fontWeight: 600 }}>
          {log.barcode?.startsWith('dish-') && <ChefHat size={14} color="var(--amber)" style={{ marginRight: 5, verticalAlign: -2 }} />}
          {log.name}
        </div>
        <div className="grid2">
          <label className="field"><span>Cantidad ({unit})</span>
            <NumInput className="mono" value={grams} onChange={setGrams} autoFocus />
          </label>
          <label className="field"><span>Hora</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <label className="field"><span>Día</span><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <div className="chips">
          {MEALS.map((x) => <button key={x.id} className={`chip ${meal === x.id ? 'on' : ''}`} onClick={() => setMeal(x.id)}><x.icon size={14} /> {x.label}</button>)}
        </div>
        <div className="card grid3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', padding: 12 }}>
          <div className="kpi"><span className="v" style={{ fontSize: 18 }}>{r0(m.kcal)}</span><span className="l">kcal</span></div>
          <div className="kpi"><span className="v" style={{ fontSize: 18, color: 'var(--protein)' }}>{r1(m.protein)}</span><span className="l">Prot</span></div>
          <div className="kpi"><span className="v" style={{ fontSize: 18, color: 'var(--carbs)' }}>{r1(m.carbs)}</span><span className="l">Carb</span></div>
          <div className="kpi"><span className="v" style={{ fontSize: 18, color: 'var(--fat)' }}>{r1(m.fat)}</span><span className="l">Grasa</span></div>
        </div>
        <div className="grid2">
          <button className="btn-danger" onClick={remove}><Trash2 size={16} /> Eliminar</button>
          {changed
            ? <button className="btn-primary" disabled={busy || !grams} onClick={save}>{busy ? <span className="spin" /> : 'Guardar'}</button>
            : <button className="btn-ghost" disabled>Sin cambios</button>}
        </div>
      </div>
    </Sheet>
  )
}
