import { Target, User, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ACTIVITY_FACTORS, ageFromBirthdate, bmr, macroTargets } from '../lib/formulas'
import type { Profile } from '../lib/types'
import { Seg, num, r0 } from './ui'

const ACTIVITY_LABELS = ['Sedentario', 'Ligero', 'Moderado', 'Alto', 'Muy alto']
const MODES = [
  { id: 'adaptive', label: 'Adaptativo' },
  { id: 'dynamic', label: 'Dinámico' },
  { id: 'factor', label: 'Factor fijo' },
] as const
const MODE_HELP: Record<string, string> = {
  adaptive: 'Basal × factor. El factor se recalcula con la media de 14 días de pasos y entrenos registrados.',
  dynamic: 'Basal × 1.2 + kcal de pasos + kcal de entreno de cada día.',
  factor: 'Basal × factor fijo según tu nivel de actividad (1–5).',
}

export type ProfileDraft = Partial<Profile>

export default function ProfileForm({ initial, onSubmit, submitLabel }: {
  initial: Partial<Profile>
  onSubmit: (p: ProfileDraft) => Promise<void> | void
  submitLabel: string
}) {
  const [p, setP] = useState<ProfileDraft>({
    sex: 'male', activity_level: 2, energy_mode: 'adaptive', protein_g_kg: 2, fat_g_kg: 0.9, deficit_kcal: 400,
    kcal_tolerance_pct: 10, protein_min_pct: 90, steps_goal: 8000, ...initial,
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Profile>(k: K, v: Profile[K] | null) => setP((o) => ({ ...o, [k]: v }))
  const n = (k: keyof Profile) => (p[k] == null ? '' : String(p[k]))

  const preview = useMemo(() => {
    if (!p.weight_kg || !p.height_cm || !p.birthdate || !p.sex) return null
    const b = bmr(p.sex, p.weight_kg, p.height_cm, ageFromBirthdate(p.birthdate))
    const f = p.energy_mode === 'factor' || p.energy_mode === 'adaptive'
      ? Number(p.activity_factor ?? ACTIVITY_FACTORS[(p.activity_level ?? 2) - 1]) : 1.2
    return { bmr: b, ...macroTargets(b * f, Number(p.deficit_kcal ?? 0), p.weight_kg, Number(p.protein_g_kg), Number(p.fat_g_kg)) }
  }, [p])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    await onSubmit(p)
    setBusy(false)
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="card stack">
        <h2><User size={14} /> Datos personales</h2>
        <label className="field"><span>Nombre</span>
          <input value={n('display_name')} onChange={(e) => set('display_name', e.target.value)} placeholder="Álvaro" />
        </label>
        <div className="row between">
          <span className="small muted">Sexo (para las fórmulas)</span>
          <Seg value={p.sex ?? 'male'} onChange={(v) => set('sex', v)} options={[{ id: 'male', label: 'Hombre' }, { id: 'female', label: 'Mujer' }]} />
        </div>
        <div className="grid3">
          <label className="field"><span>Peso (kg)</span>
            <input inputMode="decimal" required value={n('weight_kg')} onChange={(e) => set('weight_kg', num(e.target.value))} />
          </label>
          <label className="field"><span>Altura (cm)</span>
            <input inputMode="decimal" required value={n('height_cm')} onChange={(e) => set('height_cm', num(e.target.value))} />
          </label>
          <label className="field"><span>Peso objetivo</span>
            <input inputMode="decimal" value={n('goal_weight_kg')} onChange={(e) => set('goal_weight_kg', num(e.target.value))} />
          </label>
        </div>
        <label className="field"><span>Fecha de nacimiento</span>
          <input type="date" required value={n('birthdate')} onChange={(e) => set('birthdate', e.target.value)} />
        </label>
      </div>

      <div className="card stack">
        <h2><Zap size={14} /> Actividad y gasto</h2>
        <label className="field"><span>Nivel de actividad: <b className="mono">{p.activity_level}</b> · {ACTIVITY_LABELS[(p.activity_level ?? 2) - 1]} (×{ACTIVITY_FACTORS[(p.activity_level ?? 2) - 1]})</span>
          <input type="range" min={1} max={5} step={1} value={p.activity_level ?? 2}
            onChange={(e) => { const l = Number(e.target.value); setP((o) => ({ ...o, activity_level: l, activity_factor: ACTIVITY_FACTORS[l - 1] })) }} />
        </label>
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">Modo de cálculo del gasto</span>
          <Seg variant="full" value={p.energy_mode ?? 'adaptive'} onChange={(v) => set('energy_mode', v)} options={MODES.map((m) => ({ ...m }))} />
          <span className="small faint">{MODE_HELP[p.energy_mode ?? 'adaptive']}</span>
        </div>
        {p.energy_mode !== 'dynamic' && (
          <label className="field"><span>Factor actual</span>
            <input inputMode="decimal" value={n('activity_factor')} onChange={(e) => set('activity_factor', num(e.target.value))} />
          </label>
        )}
        <label className="field"><span>Objetivo de pasos diarios</span>
          <input inputMode="numeric" value={n('steps_goal')} onChange={(e) => set('steps_goal', num(e.target.value))} />
        </label>
      </div>

      <div className="card stack">
        <h2><Target size={14} /> Objetivos</h2>
        <div className="grid3">
          <label className="field"><span>Proteína g/kg</span>
            <input inputMode="decimal" value={n('protein_g_kg')} onChange={(e) => set('protein_g_kg', num(e.target.value))} />
          </label>
          <label className="field"><span>Grasa g/kg</span>
            <input inputMode="decimal" value={n('fat_g_kg')} onChange={(e) => set('fat_g_kg', num(e.target.value))} />
          </label>
          <label className="field"><span>Déficit kcal</span>
            <input inputMode="numeric" value={n('deficit_kcal')} onChange={(e) => set('deficit_kcal', num(e.target.value))} />
          </label>
        </div>
        <span className="small faint">Carbohidratos = kcal restantes ÷ 4. Un déficit negativo = superávit.</span>
        <div className="grid2">
          <label className="field"><span>Tolerancia kcal (±%)</span>
            <input inputMode="numeric" value={n('kcal_tolerance_pct')} onChange={(e) => set('kcal_tolerance_pct', num(e.target.value))} />
          </label>
          <label className="field"><span>Proteína mínima (%)</span>
            <input inputMode="numeric" value={n('protein_min_pct')} onChange={(e) => set('protein_min_pct', num(e.target.value))} />
          </label>
        </div>
        {preview && (
          <div className="grid3" style={{ marginTop: 4 }}>
            <div className="kpi"><span className="v">{r0(preview.bmr)}</span><span className="l">Basal</span></div>
            <div className="kpi"><span className="v" style={{ color: 'var(--cyan)' }}>{r0(preview.kcal)}</span><span className="l">kcal objetivo</span></div>
            <div className="kpi"><span className="v small mono">{r0(preview.protein)}P · {r0(preview.carbs)}C · {r0(preview.fat)}G</span><span className="l">Macros (g)</span></div>
          </div>
        )}
      </div>

      <button className="btn-primary btn-block" disabled={busy}>{busy ? <span className="spin" /> : submitLabel}</button>
    </form>
  )
}
