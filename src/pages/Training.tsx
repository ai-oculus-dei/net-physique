import { BookOpen, CalendarClock, CircleCheck, Dumbbell, Flame, Footprints, Plus, Repeat, Sofa } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import BodyHeatmap from '../components/BodyHeatmap'
import DayPicker from '../components/DayPicker'
import ExercisePicker, { ExerciseDetail } from '../components/ExercisePicker'
import WorkoutEditor from '../components/WorkoutEditor'
import { Bar, Empty, Sheet, num, r0, toast } from '../components/ui'
import { latestWeight } from '../lib/energy'
import { fmtDay, ymd } from '../lib/dates'
import { stepsKcal } from '../lib/formulas'
import { muscleEs } from '../lib/muscles'
import { supabase } from '../lib/supabase'
import type { Exercise, Workout } from '../lib/types'
import { doneLoad, draftFrom, recentWorkouts, saveWorkout, weekWorkouts, type WorkoutDraft } from '../lib/workouts'
import { useApp } from '../stores/app'

export default function Training() {
  const profile = useApp((s) => s.profile)!
  const [day, setDay] = useState(ymd())
  const [week, setWeek] = useState<Workout[]>([])
  const [draft, setDraft] = useState<WorkoutDraft | null>(null)
  const [kg, setKg] = useState(Number(profile.weight_kg ?? 70))
  const [steps, setSteps] = useState('')
  const [browse, setBrowse] = useState<string | null | undefined>(undefined)
  const [info, setInfo] = useState<Exercise | null>(null)
  const [recent, setRecent] = useState<Workout[]>([])

  const load = useCallback(async () => {
    setWeek(await weekWorkouts(day))
    const { data } = await supabase.from('steps').select('steps').eq('day', day).maybeSingle()
    setSteps(data ? String(data.steps) : '')
  }, [day])
  useEffect(() => { load() }, [load])
  useEffect(() => { latestWeight(profile, day).then(setKg) }, [profile, day])
  useEffect(() => {
    recentWorkouts().then(setRecent).catch(() => {})
  }, [week])

  const load7 = useMemo(() => doneLoad(week), [week])
  const today = week.filter((w) => w.day === day)
  const totalSets = Object.values(load7).reduce((a, b) => a + b, 0)

  async function saveSteps() {
    const n = num(steps)
    if (n == null) return
    const kcal = Math.round(stepsKcal(n, kg, Number(profile.height_cm ?? 170)))
    const { error } = await supabase.from('steps').upsert({ day, steps: n, kcal })
    error ? toast.err(error.message) : toast(`${n} pasos · ${kcal} kcal`)
  }

  // Marcar ejercicio hecho directamente desde la lista (plan → registro)
  async function toggle(w: Workout, idx: number) {
    const d = draftFrom(w)
    d.items[idx] = { ...d.items[idx], done: !d.items[idx].done }
    await saveWorkout(d, kg)
    load()
  }

  const newDraft = (): WorkoutDraft => ({ day, title: '', intensity: 'moderate', duration_min: null, notes: null, items: [] })
  const stepsN = num(steps) ?? 0

  return (
    <div className="shell">
      <div className="topbar">
        <div>
          <h1><Dumbbell size={22} /> Training</h1>
          <div className="sub">{r0(totalSets)} series esta semana · {r0(kg)} kg</div>
        </div>
        <DayPicker day={day} onChange={setDay} allowFuture />
      </div>

      <div className="stack">
        <div className="card glow">
          <div className="row between">
            <h2 style={{ margin: 0 }}><Flame size={14} /> Mapa de calor semanal</h2>
            <span className="tiny faint">toca un músculo</span>
          </div>
          <BodyHeatmap load={load7} onPick={(m) => setBrowse(m)} />
        </div>

        <div className="card">
          <h2><Footprints size={14} /> Pasos</h2>
          <div className="row">
            <input className="mono grow" inputMode="numeric" placeholder="0" value={steps} onChange={(e) => setSteps(e.target.value)} />
            <button className="btn-primary" onClick={saveSteps}>Guardar</button>
          </div>
          <div style={{ marginTop: 10 }}><Bar value={stepsN} max={profile.steps_goal} color="var(--lime)" /></div>
          <div className="row between small muted mono" style={{ marginTop: 6 }}>
            <span>{r0((stepsN / Math.max(profile.steps_goal, 1)) * 100)}% de {profile.steps_goal}</span>
            <span>≈ {r0(stepsKcal(stepsN, kg, Number(profile.height_cm ?? 170)))} kcal</span>
          </div>
        </div>

        <div className="row between">
          <h2 className="tiny muted" style={{ margin: 0 }}>Sesiones · {fmtDay(day)}</h2>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn-sm" onClick={() => setBrowse(null)}><BookOpen size={15} /> Catálogo</button>
            <button className="btn-sm btn-primary" onClick={() => setDraft(newDraft())}><Plus size={15} /> Sesión</button>
          </div>
        </div>

        {today.length === 0 && <Empty icon={Sofa}>Sin sesiones este día. Crea una o planifícala.</Empty>}
        {today.map((w) => {
          const done = w.workout_sets.filter((s) => s.done).length
          return (
            <div key={w.id} className="card" style={{ borderColor: w.planned ? 'var(--line-strong)' : 'color-mix(in srgb, var(--ok) 50%, transparent)' }}>
              <div className="row between">
                <div>
                  <h3 className="ic">{w.planned ? <CalendarClock size={17} color="var(--muted)" /> : <CircleCheck size={17} color="var(--ok)" />} {w.title || 'Sesión'}</h3>
                  <div className="small muted mono">{done}/{w.workout_sets.length} · {r0(w.kcal)} kcal{w.duration_min ? ` · ${w.duration_min} min` : ''}</div>
                </div>
                <button className="btn-sm btn-ghost" onClick={() => setDraft(draftFrom(w))}>Editar</button>
              </div>
              <div className="list" style={{ marginTop: 6 }}>
                {w.workout_sets.map((s, i) => (
                  <div key={s.id} className="list-item">
                    <input type="checkbox" checked={s.done} onChange={() => toggle(w, i)} />
                    <div className="grow" onClick={() => setInfo(s.exercise)} style={{ cursor: 'pointer' }}>
                      <div className="ellipsis">{s.exercise.name}</div>
                      <div className="small muted">{s.exercise.primary_muscles.map(muscleEs).join(', ')}</div>
                    </div>
                    <span className="mono small">{s.minutes ? `${s.minutes}′` : `${s.sets}×${s.reps}${s.weight_kg ? ` @${s.weight_kg}` : ''}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {recent.length > 0 && (
          <div className="card">
            <h2><Repeat size={14} /> Repetir sesión anterior como plan</h2>
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {recent.map((w) => (
                <button key={w.id} className="chip" onClick={() => setDraft(draftFrom(w, day))}>
                  {w.title || 'Sesión'} · {fmtDay(w.day, { day: 'numeric', month: 'short' })}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {draft && (
        <WorkoutEditor draft={draft} kg={kg} weekLoad={doneLoad(week, draft.id)}
          onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load() }} />
      )}
      <ExercisePicker open={browse !== undefined} initialMuscle={browse ?? null} onClose={() => setBrowse(undefined)}
        onPick={(e) => { setBrowse(undefined); setInfo(e) }} />
      <Sheet open={!!info} onClose={() => setInfo(null)} title={info?.name}>
        {info && <ExerciseDetail e={info} />}
      </Sheet>
    </div>
  )
}
