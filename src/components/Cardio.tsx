import { Bike, Fan, Footprints, Gauge, HeartPulse, Infinity as InfinityIcon, Route, Snowflake, Volleyball, Waves, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NumInput, Seg, Sheet, r0 } from './ui'
import { CARDIO, METHOD_LABEL, cardioActivity, type Body, type CardioField } from '../lib/cardio'
import { cardioSetKcal } from '../lib/energy'
import { allExercises } from '../lib/exercises'
import type { Exercise, WorkoutSet } from '../lib/types'

export const CARDIO_ICON: Record<string, LucideIcon> = {
  cardio_running: Footprints, cardio_eliptica: InfinityIcon, cardio_bici: Bike, cardio_assault: Fan,
  cardio_remo: Waves, cardio_skierg: Snowflake, cardio_padel: Volleyball,
}

/** Ejercicio de una actividad (de la base de datos; si aún no cargó, uno local equivalente) */
function stubExercise(id: string): Exercise {
  const a = cardioActivity(id)!
  return {
    id, name: a.name, force: null, level: null, mechanic: null, equipment: null, primary_muscles: [],
    secondary_muscles: [], instructions: [], category: 'cardio', images: [], is_custom: false,
  }
}

/** Selector de las actividades de cardio de la app */
export function CardioPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const [byId, setById] = useState<Record<string, Exercise>>({})
  useEffect(() => {
    if (!open) return
    allExercises().then((list) => setById(Object.fromEntries(list.filter((e) => e.id.startsWith('cardio_')).map((e) => [e.id, e])))).catch(() => {})
  }, [open])
  return (
    <Sheet open={open} onClose={onClose} title={<span className="ic"><HeartPulse size={18} color="var(--cyan)" /> Cardio</span>}>
      <div className="cardio-grid">
        {CARDIO.map((a) => {
          const Icon = CARDIO_ICON[a.id]
          return (
            <button key={a.id} type="button" className="cardio-tile" onClick={() => onPick(byId[a.id] ?? stubExercise(a.id))}>
              <Icon size={24} />
              <span>{a.name}</span>
            </button>
          )
        })}
      </div>
      <p className="small faint" style={{ marginBottom: 0 }}>
        Con el tiempo basta; si añades km, vatios, kcal de la máquina o pulsaciones, el cálculo es más preciso.
      </p>
    </Sheet>
  )
}

const FIELD_LABEL: Record<CardioField, { label: string; icon: LucideIcon; decimal: boolean }> = {
  distance: { label: 'Distancia km', icon: Route, decimal: true },
  watts: { label: 'Vatios', icon: Zap, decimal: false },
  machineKcal: { label: 'kcal máq.', icon: Gauge, decimal: false },
  hr: { label: 'FC media', icon: HeartPulse, decimal: false },
}
const FIELD_KEY: Record<CardioField, 'distance_km' | 'avg_watts' | 'machine_kcal' | 'avg_hr'> = {
  distance: 'distance_km', watts: 'avg_watts', machineKcal: 'machine_kcal', hr: 'avg_hr',
}

/** Campos de una actividad de cardio dentro del entreno + kcal calculadas */
export function CardioFields({ s, body, defaultMinutes, fresh, onChange }: {
  s: WorkoutSet; body: Body; defaultMinutes: number; fresh: boolean; onChange: (patch: Partial<WorkoutSet>) => void
}) {
  const a = cardioActivity(s.exercise_id)
  const fields: CardioField[] = a ? a.fields : ['hr']
  const r = cardioSetKcal(s, body)
  return (
    <div className="stack" style={{ gap: 8, marginTop: 8 }}>
      <div className="row" style={{ gap: 10 }}>
        <label className="field" style={{ width: 92, flexShrink: 0 }}><span>Minutos</span>
          <NumInput value={s.minutes} fallback={defaultMinutes} fallbackAsPlaceholder={fresh} onChange={(v) => onChange({ minutes: v ?? defaultMinutes })} />
        </label>
        <div className="stack grow" style={{ gap: 5 }}>
          <span className="small muted">Intensidad</span>
          <Seg variant="full" value={s.intensity ?? 'moderate'} onChange={(v) => onChange({ intensity: v })}
            options={[{ id: 'light', label: 'Suave' }, { id: 'moderate', label: 'Media' }, { id: 'vigorous', label: 'Intensa' }]} />
        </div>
      </div>
      <div className={fields.length > 2 ? 'grid3' : 'grid2'}>
        {fields.map((f) => {
          const { label, icon: Icon, decimal } = FIELD_LABEL[f]
          const key = FIELD_KEY[f]
          return (
            <label key={f} className="field"><span className="ic"><Icon size={12} /> {label}</span>
              <NumInput decimal={decimal} value={s[key] ?? null} placeholder="opcional" onChange={(v) => onChange({ [key]: v })} />
            </label>
          )
        })}
      </div>
      <div className="cardio-kcal small mono">
        <b>{r0(r.net)} kcal</b> netas <span className="muted">· {METHOD_LABEL[r.method]}</span>
        <span className="faint"> (brutas {r0(r.gross)})</span>
      </div>
    </div>
  )
}
