import { Flame, Info, ListChecks, Plus, Timer, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import BodyHeatmap from './BodyHeatmap'
import ExercisePicker, { ExerciseDetail } from './ExercisePicker'
import { Seg, Sheet, NumInput, r0, toast } from './ui'
import { workoutKcal } from '../lib/energy'
import { epley1rm } from '../lib/formulas'
import { muscleEs, muscleLoad } from '../lib/muscles'
import type { Exercise, WorkoutSet } from '../lib/types'
import { deleteWorkout, saveWorkout, type WorkoutDraft } from '../lib/workouts'

export default function WorkoutEditor({ draft: initial, weekLoad, kg, onClose, onSaved }: {
  draft: WorkoutDraft; weekLoad: Record<string, number>; kg: number; onClose: () => void; onSaved: () => void
}) {
  const [d, setD] = useState<WorkoutDraft>(initial)
  const [picking, setPicking] = useState(false)
  const [info, setInfo] = useState<Exercise | null>(null)
  const [busy, setBusy] = useState(false)

  const setItem = (i: number, patch: Partial<WorkoutSet>) =>
    setD((o) => ({ ...o, items: o.items.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  function add(e: Exercise) {
    const cardio = e.category === 'cardio'
    setD((o) => ({
      ...o,
      items: [...o.items, {
        exercise_id: e.id, exercise: e, position: o.items.length, sets: cardio ? 1 : 3, reps: cardio ? 1 : 10,
        weight_kg: null, minutes: cardio ? 20 : null, done: false,
      }],
    }))
    setPicking(false)
  }

  // Previsualización: semana hecha (sin este entreno) + todo lo de este entreno
  const preview = useMemo(() => {
    const mine = muscleLoad(d.items)
    const out = { ...weekLoad }
    for (const [m, v] of Object.entries(mine)) out[m] = (out[m] ?? 0) + v
    return out
  }, [d.items, weekLoad])

  const doneItems = d.items.filter((s) => s.done)
  const estKcal = workoutKcal(doneItems.length ? doneItems : d.items, kg, d.intensity,
    doneItems.length === d.items.length ? d.duration_min : null)

  async function save() {
    setBusy(true)
    try {
      await saveWorkout(d, kg)
      toast(doneItems.length ? `Entreno guardado · ${r0(estKcal)} kcal` : 'Plan guardado')
      onSaved()
    } catch (e: any) { toast.err(e.message) }
    setBusy(false)
  }

  return (
    <Sheet open onClose={onClose} title={d.id ? 'Editar sesión' : 'Nueva sesión'}>
      <div className="stack">
        <div className="grid2">
          <label className="field"><span>Título</span>
            <input value={d.title} placeholder="Pierna, Push…" onChange={(e) => setD({ ...d, title: e.target.value })} />
          </label>
          <label className="field"><span>Fecha</span>
            <input type="date" value={d.day} onChange={(e) => setD({ ...d, day: e.target.value })} />
          </label>
        </div>
        <div className="row between wrap">
          <Seg value={d.intensity} onChange={(v) => setD({ ...d, intensity: v })}
            options={[{ id: 'light', label: 'Suave' }, { id: 'moderate', label: 'Media' }, { id: 'vigorous', label: 'Intensa' }]} />
          <label className="row small muted" style={{ gap: 6 }}><Timer size={16} />
            <NumInput style={{ width: 70 }} decimal={false} placeholder="min" value={d.duration_min}
              onChange={(v) => setD({ ...d, duration_min: v })} />
          </label>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <h2><Flame size={14} /> Mapa de calor previsto (semana)</h2>
          <BodyHeatmap load={preview} />
        </div>

        <div className="stack" style={{ gap: 8 }}>
          {d.items.map((s, i) => {
            const cardio = s.exercise.category === 'cardio'
            return (
              <div key={i} className="card" style={{ padding: 12, borderColor: s.done ? 'var(--ok)' : undefined }}>
                <div className="row">
                  <input type="checkbox" checked={s.done} onChange={(e) => setItem(i, { done: e.target.checked })} aria-label="Hecho" />
                  <div className="grow" onClick={() => setInfo(s.exercise)} style={{ cursor: 'pointer' }}>
                    <div className="ellipsis" style={{ fontWeight: 600 }}>{s.exercise.name} <Info size={13} className="faint" /></div>
                    <div className="small muted ellipsis">{s.exercise.primary_muscles.map(muscleEs).join(', ')}</div>
                  </div>
                  <button className="btn-icon btn-ghost" onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })} aria-label="Quitar"><X size={16} /></button>
                </div>
                <div className="grid3" style={{ marginTop: 8 }}>
                  {cardio ? (
                    <label className="field" style={{ gridColumn: 'span 3' }}><span>Minutos</span>
                      <NumInput value={s.minutes} onChange={(v) => setItem(i, { minutes: v })} />
                    </label>
                  ) : (
                    <>
                      <label className="field"><span>Series</span>
                        <NumInput decimal={false} value={s.sets} onChange={(v) => setItem(i, { sets: v ?? 0 })} /></label>
                      <label className="field"><span>Reps</span>
                        <NumInput decimal={false} value={s.reps} onChange={(v) => setItem(i, { reps: v ?? 0 })} /></label>
                      <label className="field"><span>Peso kg</span>
                        <NumInput value={s.weight_kg} placeholder="—" onChange={(v) => setItem(i, { weight_kg: v })} /></label>
                    </>
                  )}
                </div>
                {s.weight_kg ? <div className="tiny faint mono" style={{ marginTop: 6 }}>1RM est. {r0(epley1rm(s.weight_kg, s.reps))} kg · volumen {r0(s.sets * s.reps * s.weight_kg)} kg</div> : null}
              </div>
            )
          })}
          <button onClick={() => setPicking(true)}><Plus size={17} /> Añadir ejercicio</button>
        </div>

        <div className="row between small mono">
          <span className="muted">{doneItems.length}/{d.items.length} hechos</span>
          <span>≈ {r0(estKcal)} kcal</span>
        </div>
        <div className="grid2">
          {d.id ? <button className="btn-danger" onClick={async () => { await deleteWorkout(d.id!); onSaved() }}>Eliminar</button>
            : <button className="btn-ghost" onClick={() => setD({ ...d, items: d.items.map((s) => ({ ...s, done: true })) })}><ListChecks size={16} /> Marcar todo</button>}
          <button className="btn-primary" disabled={busy || !d.items.length} onClick={save}>{busy ? <span className="spin" /> : 'Guardar'}</button>
        </div>
      </div>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={add} />
      <Sheet open={!!info} onClose={() => setInfo(null)} title={info?.name}>
        {info && <ExerciseDetail e={info} />}
      </Sheet>
    </Sheet>
  )
}
