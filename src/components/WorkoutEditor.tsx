import { Flame, HeartPulse, Info, ListChecks, Plus, Timer, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import BodyHeatmap from './BodyHeatmap'
import { CARDIO_ICON, CardioFields, CardioPicker } from './Cardio'
import ExercisePicker, { ExerciseDetail } from './ExercisePicker'
import { Seg, Sheet, NumInput, r0, toast } from './ui'
import { isCardio, workoutKcal } from '../lib/energy'
import type { Body } from '../lib/cardio'
import { epley1rm } from '../lib/formulas'
import { muscleEs, muscleLoad } from '../lib/muscles'
import type { Exercise, WorkoutSet } from '../lib/types'
import { deleteWorkout, saveWorkout, type WorkoutDraft } from '../lib/workouts'

// Valores por defecto de un ejercicio nuevo: se muestran en gris y se usan si no se escribe nada
const DEFAULT_SETS = 3
const DEFAULT_REPS = 10
const DEFAULT_CARDIO_MIN = 20

export default function WorkoutEditor({ draft: initial, weekLoad, body, onClose, onSaved }: {
  draft: WorkoutDraft; weekLoad: Record<string, number>; body: Body; onClose: () => void; onSaved: () => void
}) {
  const [d, setD] = useState<WorkoutDraft>(initial)
  const [picking, setPicking] = useState(false)
  const [pickingCardio, setPickingCardio] = useState(false)
  const [info, setInfo] = useState<Exercise | null>(null)
  const [busy, setBusy] = useState(false)

  const setItem = (i: number, patch: Partial<WorkoutSet>) =>
    setD((o) => ({ ...o, items: o.items.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  function add(e: Exercise) {
    const cardio = e.category === 'cardio'
    setD((o) => ({
      ...o,
      items: [...o.items, {
        exercise_id: e.id, exercise: e, position: o.items.length, sets: cardio ? 1 : DEFAULT_SETS, reps: cardio ? 1 : DEFAULT_REPS,
        weight_kg: null, minutes: cardio ? DEFAULT_CARDIO_MIN : null, done: false,
        intensity: cardio ? 'moderate' : null,
      }],
    }))
    setPicking(false)
    setPickingCardio(false)
  }

  // Previsualización: semana hecha (sin este entreno) + todo lo de este entreno
  const preview = useMemo(() => {
    const mine = muscleLoad(d.items)
    const out = { ...weekLoad }
    for (const [m, v] of Object.entries(mine)) out[m] = (out[m] ?? 0) + v
    return out
  }, [d.items, weekLoad])

  const doneItems = d.items.filter((s) => s.done)
  const estKcal = workoutKcal(doneItems.length ? doneItems : d.items, body, d.intensity,
    doneItems.length === d.items.length ? d.duration_min : null)

  async function save() {
    setBusy(true)
    try {
      await saveWorkout(d, body)
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
            const cardio = isCardio(s)
            const CIcon = CARDIO_ICON[s.exercise_id]
            return (
              <div key={i} className="card" style={{ padding: 12, borderColor: s.done ? 'var(--ok)' : undefined }}>
                <div className="row">
                  <input type="checkbox" checked={s.done} onChange={(e) => setItem(i, { done: e.target.checked })} aria-label="Hecho" />
                  <div className="grow" onClick={() => setInfo(s.exercise)} style={{ cursor: 'pointer' }}>
                    <div className="ellipsis" style={{ fontWeight: 600 }}>
                      {cardio && (CIcon ? <CIcon size={15} color="var(--cyan)" style={{ marginRight: 5, verticalAlign: -2 }} /> : <HeartPulse size={15} color="var(--cyan)" style={{ marginRight: 5, verticalAlign: -2 }} />)}
                      {s.exercise.name} <Info size={13} className="faint" />
                    </div>
                    <div className="small muted ellipsis">{cardio ? 'Cardio' : s.exercise.primary_muscles.map(muscleEs).join(', ')}</div>
                  </div>
                  <button className="btn-icon btn-ghost" onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })} aria-label="Quitar"><X size={16} /></button>
                </div>
                {cardio ? (
                  <CardioFields s={s} body={body} defaultMinutes={DEFAULT_CARDIO_MIN} fresh={!s.workout_id} onChange={(patch) => setItem(i, patch)} />
                ) : (
                <div className="grid3" style={{ marginTop: 8 }}>
                    <>
                      <label className="field"><span>Series</span>
                        <NumInput decimal={false} value={s.sets} fallback={DEFAULT_SETS} fallbackAsPlaceholder={!s.workout_id} onChange={(v) => setItem(i, { sets: v ?? DEFAULT_SETS })} /></label>
                      <label className="field"><span>Reps</span>
                        <NumInput decimal={false} value={s.reps} fallback={DEFAULT_REPS} fallbackAsPlaceholder={!s.workout_id} onChange={(v) => setItem(i, { reps: v ?? DEFAULT_REPS })} /></label>
                      <label className="field"><span>Peso kg</span>
                        <NumInput value={s.weight_kg} placeholder="—" onChange={(v) => setItem(i, { weight_kg: v })} /></label>
                    </>
                </div>
                )}
                {s.weight_kg ? <div className="tiny faint mono" style={{ marginTop: 6 }}>1RM est. {r0(epley1rm(s.weight_kg, s.reps))} kg · volumen {r0(s.sets * s.reps * s.weight_kg)} kg</div> : null}
              </div>
            )
          })}
          <div className="grid2">
            <button onClick={() => setPicking(true)}><Plus size={17} /> Ejercicio</button>
            <button onClick={() => setPickingCardio(true)}><HeartPulse size={17} /> Cardio</button>
          </div>
        </div>

        <div className="row between small mono">
          <span className="muted">{doneItems.length}/{d.items.length} hechos</span>
          <span>≈ {r0(estKcal)} kcal netas</span>
        </div>
        <div className="grid2">
          {d.id ? <button className="btn-danger" onClick={async () => { await deleteWorkout(d.id!); onSaved() }}>Eliminar</button>
            : <button className="btn-ghost" onClick={() => setD({ ...d, items: d.items.map((s) => ({ ...s, done: true })) })}><ListChecks size={16} /> Marcar todo</button>}
          <button className="btn-primary" disabled={busy || !d.items.length} onClick={save}>{busy ? <span className="spin" /> : 'Guardar'}</button>
        </div>
      </div>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={add} />
      <CardioPicker open={pickingCardio} onClose={() => setPickingCardio(false)} onPick={add} />
      <Sheet open={!!info} onClose={() => setInfo(null)} title={info?.name}>
        {info && <ExerciseDetail e={info} />}
      </Sheet>
    </Sheet>
  )
}
