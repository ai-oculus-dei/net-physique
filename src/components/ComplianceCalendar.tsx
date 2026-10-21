import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, ymd } from '../lib/dates'
import { useApp } from '../stores/app'
import { computeDayEnergy } from '../lib/energy'
import { DIET_OVER_OFF_PCT, DIET_OVER_WARN_PCT, dietDayLevel, type DietLevel } from '../lib/compliance'

interface DayStatus { diet: DietLevel | null; training: boolean | null; kcal: number; target: number | null }

const DIET_LABEL: Record<DietLevel, string> = {
  green: `hasta +${DIET_OVER_WARN_PCT}% del objetivo`,
  orange: `+${DIET_OVER_WARN_PCT}–${DIET_OVER_OFF_PCT}% sobre el objetivo`,
  red: `más de +${DIET_OVER_OFF_PCT}% sobre el objetivo`,
}

/** Dieta: color según el balance neto del día (ver lib/compliance) · Entreno: sesión hecha o pasos ≥ objetivo */
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
        supabase.from('food_logs').select('day,kcal').gte('day', first).lte('day', last),
        supabase.from('daily_energy').select('day,target_kcal').gte('day', first).lte('day', last),
        supabase.from('workouts').select('day').eq('planned', false).gte('day', first).lte('day', last),
        supabase.from('steps').select('day,steps').gte('day', first).lte('day', last),
      ])
      const consumed = new Map<string, number>()
      for (const r of food.data ?? []) consumed.set(r.day, (consumed.get(r.day) ?? 0) + Number(r.kcal))
      const target = new Map<string, number>((targets.data ?? []).map((r) => [r.day, Number(r.target_kcal)]))
      // días con comidas pero sin objetivo guardado: se calcula igual que en Diet
      await Promise.all([...consumed.keys()].filter((d) => !target.has(d)).map(async (d) => {
        target.set(d, Math.round((await computeDayEnergy(profile, d)).kcal))
      }))

      const out: Record<string, DayStatus> = {}
      for (let i = 0; i < daysIn; i++) {
        const d = addDays(first, i)
        const kcal = consumed.get(d) ?? 0
        const t = target.get(d) ?? null
        const diet = dietDayLevel(kcal, t)
        const trained = (wos.data ?? []).some((r) => r.day === d)
        const st = (steps.data ?? []).find((r) => r.day === d)?.steps ?? 0
        const training = d > ymd() ? null : trained || st >= profile.steps_goal
        out[d] = { diet, training, kcal, target: t }
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
              title={s?.target && s.diet ? `${Math.round(s.kcal)} / ${s.target} kcal · ${DIET_LABEL[s.diet]}` : undefined}>
              <span className="mono" style={{ opacity: d > ymd() ? 0.35 : 1 }}>{i + 1}</span>
              <div className="dots"><i className={`d ${s?.diet ? `on ${s.diet}` : ''}`} /><i className={`t ${s?.training ? 'on' : ''}`} /></div>
            </div>
          )
        })}
      </div>
      <div className="cal-legend small">
        <span className="muted">Dieta</span>
        <span><i className="dot-l green" /> ≤+{DIET_OVER_WARN_PCT}% <b className="mono">{dietOk}</b></span>
        <span><i className="dot-l orange" /> +{DIET_OVER_WARN_PCT}–{DIET_OVER_OFF_PCT}% <b className="mono">{dietCount('orange')}</b></span>
        <span><i className="dot-l red" /> &gt;+{DIET_OVER_OFF_PCT}% <b className="mono">{dietCount('red')}</b></span>
      </div>
      <div className="row between small">
        <span><span style={{ color: 'var(--violet)' }}>●</span> Entreno/pasos <b className="mono">{trainOk}</b></span>
        <span className="muted mono">{vals.length ? Math.round(((dietOk + trainOk) / (vals.length * 2)) * 100) : 0}% total</span>
      </div>
    </div>
  )
}
