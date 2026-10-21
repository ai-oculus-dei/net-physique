import { useEffect, useMemo, useState } from 'react'
import { allExercises, createCustomExercise, filterExercises } from '../lib/exercises'
import { Dumbbell, Lightbulb, PackageOpen, PenLine, Plus } from 'lucide-react'
import { EQUIPMENT_ES, GROUPS, IMG_BASE, MUSCLE_LIST, muscleEs } from '../lib/muscles'
import type { Exercise } from '../lib/types'
import { Empty, Sheet, toast } from './ui'

export default function ExercisePicker({ open, onClose, onPick, initialMuscle }: {
  open: boolean; onClose: () => void; onPick: (e: Exercise) => void; initialMuscle?: string | null
}) {
  const [list, setList] = useState<Exercise[] | null>(null)
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [group, setGroup] = useState<string | null>(null)
  const [detail, setDetail] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    setDetail(null); setCreating(false); setMuscle(initialMuscle ?? null)
    allExercises().then(setList).catch(() => setList([]))
  }, [open, initialMuscle])

  const shown = useMemo(() => (list ? filterExercises(list, q, muscle, group).slice(0, 80) : []), [list, q, muscle, group])

  const title = detail ? detail.name : creating ? 'Nuevo ejercicio' : 'Ejercicios'
  // Con la ficha o el formulario abiertos, cerrar (X o deslizar) vuelve al buscador
  const close = detail ? () => setDetail(null) : creating ? () => setCreating(false) : onClose
  return (
    <Sheet open={open} onClose={close} title={title}>
      {detail ? (
        <ExerciseDetail e={detail} onPick={() => onPick(detail)} />
      ) : creating ? (
        <CustomForm name={q} onBack={() => setCreating(false)} onCreated={(e) => { toast('Ejercicio guardado'); onPick(e) }} />
      ) : (
        <div className="stack">
          <input placeholder="Buscar: sentadilla, press banca, remo con barra…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            {GROUPS.map((g) => (
              <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => { setGroup(group === g ? null : g); setMuscle(null) }}>
                {g}
              </button>
            ))}
          </div>
          <div className="chips">
            {MUSCLE_LIST.map((m) => (
              <button key={m} className={`chip ${muscle === m ? 'on' : ''}`} onClick={() => { setMuscle(muscle === m ? null : m); setGroup(null) }}>
                {muscleEs(m)}
              </button>
            ))}
          </div>
          {!list && <div className="empty"><span className="spin" /></div>}
          {list && list.length === 0 && <Empty icon={PackageOpen}>No hay ejercicios en la base de datos. Ejecuta el seed (README).</Empty>}
          <div className="list">
            {shown.map((e) => (
              <div key={e.id} className="list-item">
                {e.images[0] ? <img className="thumb" src={IMG_BASE + e.images[0]} alt="" loading="lazy" onClick={() => setDetail(e)} />
                  : <div className="thumb" onClick={() => setDetail(e)}><Dumbbell size={20} /></div>}
                <div className="grow" onClick={() => setDetail(e)} style={{ cursor: 'pointer' }}>
                  <div className="ellipsis">{e.name} {e.is_custom && <span className="tag">custom</span>}</div>
                  <div className="small muted ellipsis">{e.primary_muscles.map(muscleEs).join(', ')} · {EQUIPMENT_ES[e.equipment ?? ''] ?? e.equipment ?? '—'}</div>
                </div>
                <button className="btn-icon" onClick={() => onPick(e)} aria-label="Añadir"><Plus size={18} /></button>
              </div>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => setCreating(true)}><PenLine size={16} /> ¿No está? Crear ejercicio</button>
        </div>
      )}
    </Sheet>
  )
}

export function ExerciseDetail({ e, onPick }: { e: Exercise; onPick?: () => void }) {
  const [img, setImg] = useState(0)
  useEffect(() => {
    if (e.images.length < 2) return
    const t = setInterval(() => setImg((i) => (i + 1) % e.images.length), 1100)
    return () => clearInterval(t)
  }, [e])
  return (
    <div className="stack">
      {e.images.length > 0 && (
        <img src={IMG_BASE + e.images[img]} alt={e.name} style={{ width: '100%', borderRadius: 14, background: '#fff', maxHeight: 280, objectFit: 'contain' }} />
      )}
      <div className="row wrap" style={{ gap: 6 }}>
        {e.level && <span className="tag">{e.level}</span>}
        {e.category && <span className="tag">{e.category}</span>}
        {e.mechanic && <span className="tag">{e.mechanic}</span>}
        {e.equipment && <span className="tag">{EQUIPMENT_ES[e.equipment] ?? e.equipment}</span>}
      </div>
      <div className="small"><b>Principales:</b> {e.primary_muscles.map(muscleEs).join(', ') || '—'}</div>
      {e.secondary_muscles.length > 0 && <div className="small muted"><b>Secundarios:</b> {e.secondary_muscles.map(muscleEs).join(', ')}</div>}
      {e.instructions.length > 0 && (
        <div className="card" style={{ padding: 12 }}>
          <h2><Lightbulb size={14} /> Cómo hacerlo</h2>
          <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {e.instructions.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}
      {onPick && <button className="btn-primary btn-block" onClick={onPick}><Plus size={18} /> Añadir</button>}
    </div>
  )
}

function CustomForm({ name: name0, onBack, onCreated }: { name: string; onBack: () => void; onCreated: (e: Exercise) => void }) {
  const [name, setName] = useState(name0)
  const [prim, setPrim] = useState<string[]>([])
  const [sec, setSec] = useState<string[]>([])
  const [category, setCategory] = useState('strength')
  const [equipment, setEquipment] = useState('body only')
  const [tips, setTips] = useState('')
  const toggle = (arr: string[], set: (v: string[]) => void, m: string) => set(arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m])

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    if (!prim.length) return toast('Elige al menos un músculo principal')
    try {
      onCreated(await createCustomExercise({
        name, primary_muscles: prim, secondary_muscles: sec, category, equipment,
        instructions: tips.split('\n').map((s) => s.trim()).filter(Boolean),
      }))
    } catch (err: any) { toast.err(err.message) }
  }

  return (
    <form className="stack" onSubmit={save}>
      <label className="field"><span>Nombre</span><input required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid2">
        <label className="field"><span>Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {['strength', 'cardio', 'plyometrics', 'stretching', 'powerlifting'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field"><span>Material</span>
          <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            {Object.entries(EQUIPMENT_ES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <span className="small muted">Músculos principales</span>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {MUSCLE_LIST.map((m) => <button type="button" key={m} className={`chip ${prim.includes(m) ? 'on' : ''}`} onClick={() => toggle(prim, setPrim, m)}>{muscleEs(m)}</button>)}
      </div>
      <span className="small muted">Secundarios</span>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {MUSCLE_LIST.filter((m) => !prim.includes(m)).map((m) => <button type="button" key={m} className={`chip ${sec.includes(m) ? 'on' : ''}`} onClick={() => toggle(sec, setSec, m)}>{muscleEs(m)}</button>)}
      </div>
      <label className="field"><span>Consejos (uno por línea)</span><textarea rows={3} value={tips} onChange={(e) => setTips(e.target.value)} /></label>
      <div className="grid2">
        <button type="button" className="btn-ghost" onClick={onBack}>‹ Volver</button>
        <button className="btn-primary">Guardar</button>
      </div>
    </form>
  )
}
