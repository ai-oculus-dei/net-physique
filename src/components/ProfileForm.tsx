import { Target, User, Zap } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ACTIVITY_FACTORS, BMR_FORMULA_NAME, ageFromBirthdate, bmrDetail, macroTargets, type BmrFormula } from '../lib/formulas'
import { latestBodyFat, weightRef } from '../lib/energy'
import { fmtDay, ymd } from '../lib/dates'
import type { Profile } from '../lib/types'
import { NumInput, Seg, r0 } from './ui'

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

const FORMULA_HELP: Record<BmrFormula, string> = {
  auto: 'Katch-McArdle si tienes un % de grasa de los últimos 60 días; si no, Mifflin-St Jeor.',
  mifflin: 'Peso, altura, edad y sexo. No tiene en cuenta tu composición corporal.',
  katch: 'Usa tu masa magra (peso sin grasa). Necesita un % de grasa reciente.',
}

/** Valores recomendados (iguales a los predeterminados de la base de datos) */
const DEFAULTS = {
  protein_g_kg: 2, fat_g_kg: 0.9, deficit_kcal: 400, kcal_tolerance_pct: 10, protein_min_pct: 90, steps_goal: 8000,
} as const

export default function ProfileForm({ initial, onSubmit, submitLabel, requireChanges = false, defaultsAsPlaceholders = false, beforeSubmit }: {
  initial: Partial<Profile>
  /** devuelve false si no se pudo guardar */
  onSubmit: (p: ProfileDraft) => Promise<boolean | void> | boolean | void
  submitLabel: string
  /** el botón solo se activa si hay cambios sin guardar */
  requireChanges?: boolean
  /** mostrar los valores recomendados en gris en lugar de escritos (configuración inicial) */
  defaultsAsPlaceholders?: boolean
  /** contenido justo antes del botón de guardar */
  beforeSubmit?: ReactNode
}) {
  const [p, setP] = useState<ProfileDraft>(() => {
    // el tema se guarda aparte (selector de Ajustes): no se arrastra un valor antiguo al guardar el perfil
    const { theme: _t, updated_at: _u, remind_weight: _rw, remind_bodyfat: _rb, ...rest } = initial as ProfileDraft & { updated_at?: string }
    return { sex: 'male', activity_level: 2, energy_mode: 'adaptive', ...DEFAULTS, ...rest }
  })
  // última versión guardada, para saber si hay cambios pendientes
  const [saved, setSaved] = useState<ProfileDraft>(p)
  const dirty = (Object.keys(p) as (keyof Profile)[]).some((k) => String(p[k] ?? '') !== String(saved[k] ?? ''))
  const [busy, setBusy] = useState(false)
  const def = (k: keyof typeof DEFAULTS) => ({ fallback: DEFAULTS[k], fallbackAsPlaceholder: defaultsAsPlaceholders })
  const set = <K extends keyof Profile>(k: K, v: Profile[K] | null) => setP((o) => ({ ...o, [k]: v }))
  const n = (k: keyof Profile) => (p[k] == null ? '' : String(p[k]))

  // Mismos datos que usa Diet: media de los últimos pesajes y % de grasa de los últimos 60 días
  const [ref, setRef] = useState<{ kg: number; weighings: number; bodyFat: { pct: number; day: string } | null } | null>(null)
  useEffect(() => {
    const today = ymd()
    Promise.all([weightRef(initial, today), latestBodyFat(today)])
      .then(([w, bf]) => setRef({ ...w, bodyFat: bf }))
      .catch(() => setRef(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const preview = useMemo(() => {
    if (!p.weight_kg || !p.height_cm || !p.birthdate || !p.sex) return null
    const kg = ref?.weighings ? ref.kg : p.weight_kg
    const d = bmrDetail((p.bmr_formula ?? 'auto') as BmrFormula, p.sex, kg, p.height_cm, ageFromBirthdate(p.birthdate), ref?.bodyFat?.pct)
    const f = p.energy_mode === 'factor' || p.energy_mode === 'adaptive'
      ? Number(p.activity_factor ?? ACTIVITY_FACTORS[(p.activity_level ?? 2) - 1]) : 1.2
    return { bmr: d.kcal, detail: d, kg, ...macroTargets(d.kcal * f, Number(p.deficit_kcal ?? 0), kg, Number(p.protein_g_kg), Number(p.fat_g_kg)) }
  }, [p, ref])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const ok = await onSubmit(p)
    if (ok !== false) setSaved(p)
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
            <NumInput required value={p.weight_kg} onChange={(v) => set('weight_kg', v)} />
          </label>
          <label className="field"><span>Altura (cm)</span>
            <NumInput required value={p.height_cm} onChange={(v) => set('height_cm', v)} />
          </label>
          <label className="field"><span>Peso objetivo</span>
            <NumInput value={p.goal_weight_kg} onChange={(v) => set('goal_weight_kg', v)} />
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
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">Fórmula del metabolismo basal</span>
          <Seg variant="full" value={(p.bmr_formula ?? 'auto') as BmrFormula} onChange={(v) => set('bmr_formula', v)}
            options={[{ id: 'auto', label: 'Automática' }, { id: 'mifflin', label: 'Mifflin' }, { id: 'katch', label: 'Katch' }]} />
          <span className="small faint">{FORMULA_HELP[(p.bmr_formula ?? 'auto') as BmrFormula]}</span>
        </div>
        {p.energy_mode !== 'dynamic' && (
          <label className="field"><span>Factor actual</span>
            <NumInput value={p.activity_factor} fallback={ACTIVITY_FACTORS[(p.activity_level ?? 2) - 1]}
              fallbackAsPlaceholder={defaultsAsPlaceholders} onChange={(v) => set('activity_factor', v)} />
          </label>
        )}
        <label className="field"><span>Objetivo de pasos diarios</span>
          <NumInput decimal={false} {...def('steps_goal')} value={p.steps_goal} onChange={(v) => set('steps_goal', v)} />
        </label>
      </div>

      <div className="card stack">
        <h2><Target size={14} /> Objetivos</h2>
        <div className="grid3">
          <label className="field"><span>Proteína g/kg</span>
            <NumInput {...def('protein_g_kg')} value={p.protein_g_kg} onChange={(v) => set('protein_g_kg', v)} />
          </label>
          <label className="field"><span>Grasa g/kg</span>
            <NumInput {...def('fat_g_kg')} value={p.fat_g_kg} onChange={(v) => set('fat_g_kg', v)} />
          </label>
          <label className="field"><span>Déficit kcal</span>
            <NumInput decimal={false} negative inputMode="text" {...def('deficit_kcal')} value={p.deficit_kcal} onChange={(v) => set('deficit_kcal', v)} />
          </label>
        </div>
        <span className="small faint">Carbohidratos = kcal restantes ÷ 4. Un déficit negativo = superávit.</span>
        <div className="grid2">
          <label className="field"><span>Tolerancia kcal (±%)</span>
            <NumInput decimal={false} {...def('kcal_tolerance_pct')} value={p.kcal_tolerance_pct} onChange={(v) => set('kcal_tolerance_pct', v)} />
          </label>
          <label className="field"><span>Proteína mínima (%)</span>
            <NumInput decimal={false} {...def('protein_min_pct')} value={p.protein_min_pct} onChange={(v) => set('protein_min_pct', v)} />
          </label>
        </div>
        {preview && (
          <>
            <div className="grid3" style={{ marginTop: 4 }}>
              <div className="kpi"><span className="v">{r0(preview.bmr)}</span><span className="l">Basal</span></div>
              <div className="kpi"><span className="v" style={{ color: 'var(--cyan)' }}>{r0(preview.kcal)}</span><span className="l">kcal objetivo</span></div>
              <div className="kpi"><span className="v small mono">{r0(preview.protein)}P · {r0(preview.carbs)}C · {r0(preview.fat)}G</span><span className="l">Macros (g)</span></div>
            </div>
            <div className="bmr-source small">
              <b>{BMR_FORMULA_NAME[preview.detail.used]}</b>
              {preview.detail.used === 'katch' && ref?.bodyFat && (
                <span className="muted"> · {ref.bodyFat.pct} % de grasa del {fmtDay(ref.bodyFat.day, { day: 'numeric', month: 'short' })}</span>
              )}
              <span className="muted"> · peso {ref?.weighings ? `media de ${ref.weighings} pesajes (${Math.round(preview.kg * 10) / 10} kg)` : 'del perfil'}</span>
              {preview.detail.fallback && (
                <div className="warn" style={{ marginTop: 4 }}>Katch-McArdle necesita un % de grasa de los últimos 60 días: mientras tanto se usa Mifflin-St Jeor.</div>
              )}
              {p.energy_mode === 'dynamic' && <div className="faint" style={{ marginTop: 4 }}>En modo dinámico el objetivo de cada día suma además los pasos y el entreno.</div>}
            </div>
          </>
        )}
      </div>

      {beforeSubmit}
      {requireChanges && !dirty
        ? <button className="btn-ghost btn-block" disabled>Sin cambios</button>
        : <button className="btn-primary btn-block" disabled={busy}>{busy ? <span className="spin" /> : submitLabel}</button>}
    </form>
  )
}
