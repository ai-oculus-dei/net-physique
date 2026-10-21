import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, ymd } from '../lib/dates'
import { useApp } from '../stores/app'
import { computeDayEnergy } from '../lib/energy'
import { DIET_OVER_OFF_PCT, DIET_OVER_WARN_PCT, dietDayStatus, type DietLevel, type DietReason } from '../lib/compliance'

interface DayStatus {
  diet: DietLevel | null
  reasons: DietReason[]
  training: boolean | null
  kcal: number
  target: number | null
  protein: number
  proteinTarget: number | null
}

const REASON_TEXT: Record<DietReason, string> = {
  over: 'por encima del objetivo',
  under: 'por debajo de la tolerancia',
  protein: 'proteína bajo el mínimo',
}

/** Dieta: exceso de kcal, quedarse corto y proteína (ver lib/compliance) · Entreno: sesión hecha o pasos ≥ objetivo */
function dayTitle(s: DayStatus) {
  const parts = [`${Math.round(s.kcal)} / ${s.target} kcal`]
  if (s.proteinTarget) parts.push(`${Math.round(s.protein)} / ${s.proteinTarget} g proteína`)
  if (s.reasons.length) parts.push(s.reasons.map((r) => REASON_TEXT[r]).join(', '))
  return parts.join(' · ')
}

export default function ComplianceCalendar() {
  const profile = useApp((s) => s.profile)!
  const [month, setMonth] = useState(() => ymd().slice(0, 7))
  const [status, setStatus] = useState<Record<string, DayStatus>>({})

  const first = `${month}-01`
  const daysIn = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const last = `${month}-${String(daysIn).padStart(2, '0')}`

  useEffect(() => {
    (async () => {
      const [food, targets, wos, steps] = await Promise.all([
        supabase.from('food_logs').select('day,kcal,protein').gte('day', first).lte('day', last),
        supabase.from('daily_energy').select('day,target_kcal,target_protein').gte('day', first).lte('day', last),
        supabase.from('workouts').select('day').eq('planned', false).gte('day', first).lte('day', last),
        supabase.from('steps').select('day,steps').gte('day', first).lte('day', last),
      ])
      const consumed = new Map<string, { kcal: number; protein: number }>()
      for (const r of food.data ?? []) {
        const c = consumed.get(r.day) ?? { kcal: 0, protein: 0 }
        consumed.set(r.day, { kcal: c.kcal + Number(r.kcal), protein: c.protein + Number(r.protein) })
      }
      const target = new Map<string, { kcal: number; protein: number | null }>((targets.data ?? []).map((r) =>
        [r.day, { kcal: Number(r.target_kcal), protein: r.target_protein != null ? Number(r.target_protein) : null }]))
      // días con comidas pero sin objetivo guardado: se calcula igual que en Diet
      await Promise.all([...consumed.keys()].filter((d) => !target.has(d)).map(async (d) => {
        const e = await computeDayEnergy(profile, d)
        target.set(d, { kcal: Math.round(e.kcal), protein: Math.round(e.protein) })
      }))
      const today = ymd()

      const out: Record<string, DayStatus> = {}
      for (let i = 0; i < daysIn; i++) {
        const d = addDays(first, i)
        const c = consumed.get(d) ?? { kcal: 0, protein: 0 }
        const t = target.get(d)
        const ds = dietDayStatus({
          consumed: c.kcal, target: t?.kcal, protein: c.protein, proteinTarget: t?.protein,
          underTolPct: Number(profile.kcal_tolerance_pct), proteinMinPct: Number(profile.protein_min_pct),
          complete: d < today,
        })
        const trained = (wos.data ?? []).some((r) => r.day === d)
        const st = (steps.data ?? []).find((r) => r.day === d)?.steps ?? 0
        const training = d > ymd() ? null : trained || st >= profile.steps_goal
        out[d] = {
          diet: ds?.level ?? null, reasons: ds?.reasons ?? [], training, kcal: c.kcal, target: t?.kcal ?? null,
          protein: c.protein, proteinTarget: t?.protein ?? null,
        }
      }
      setStatus(out)
    })()
  }, [first, last, daysIn, profile])

  const offset = (new Date(first + 'T12:00:00').getDay() + 6) % 7
  const vals = Object.entries(status).filter(([d]) => d <= ymd())
  const dietCount = (l: DietLevel) => vals.filter(([, s]) => s.diet === l).length
  const dietOk = dietCount('green')
  const trainOk = vals.filter(([, s]) => s.training).length
  const shift = (n: number) => {
    const d = new Date(first + 'T12:00:00'); d.setMonth(d.getMonth() + n); setMonth(ymd(d).slice(0, 7))
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between">
        <button className="btn-icon btn-ghost" onClick={() => shift(-1)}>‹</button>
        <span className="mono">{new Date(first + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
        <button className="btn-icon btn-ghost" onClick={() => shift(1)} disabled={month >= ymd().slice(0, 7)}>›</button>
      </div>
      <div className="cal">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d} className="dow">{d}</div>)}
        {Array.from({ length: offset }, (_, i) => <div key={'e' + i} />)}
        {Array.from({ length: daysIn }, (_, i) => {
          const d = addDays(first, i)
          const s = status[d]
          return (
            <div key={d} className={`cell ${d === ymd() ? 'today' : ''} ${s?.diet === 'green' && s?.training ? 'both' : ''}`}
              title={s?.target && s.diet ? dayTitle(s) : undefined}>
              <span className="mono" style={{ opacity: d > ymd() ? 0.35 : 1 }}>{i + 1}</span>
              <div className="dots"><i className={`d ${s?.diet ? `on ${s.diet}` : ''}`} /><i className={`t ${s?.training ? 'on' : ''}`} /></div>
            </div>
          )
        })}
      </div>
      <div className="cal-legend small">
        <span className="muted">Dieta</span>
        <span><i className="dot-l green" /> cumplido <b className="mono">{dietOk}</b></span>
        <span><i className="dot-l orange" /> algo desviado <b className="mono">{dietCount('orange')}</b></span>
        <span><i className="dot-l red" /> &gt;+{DIET_OVER_OFF_PCT}% <b className="mono">{dietCount('red')}</b></span>
      </div>
      <div className="small faint" style={{ marginTop: -4 }}>
        Verde: hasta +{DIET_OVER_WARN_PCT}% del objetivo, sin quedarse más de un {Number(profile.kcal_tolerance_pct)}% por debajo
        y con al menos el {Number(profile.protein_min_pct)}% de la proteína. Naranja: +{DIET_OVER_WARN_PCT}–{DIET_OVER_OFF_PCT}%,
        o corto de kcal o de proteína. Rojo: más de +{DIET_OVER_OFF_PCT}%.
      </div>
      <div className="row between small">
        <span><span style={{ color: 'var(--violet)' }}>●</span> Entreno/pasos <b className="mono">{trainOk}</b></span>
        <span className="muted mono">{vals.length ? Math.round(((dietOk + trainOk) / (vals.length * 2)) * 100) : 0}% total</span>
      </div>
    </div>
  )
}
