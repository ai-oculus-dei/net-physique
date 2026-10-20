import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, ymd } from '../lib/dates'
import { useApp } from '../stores/app'

interface DayStatus { diet: boolean | null; training: boolean | null; kcal: number; target: number | null }

/** Cumplimiento: dieta = kcal dentro de ±tolerancia y proteína ≥ mínimo · entreno = sesión hecha o pasos ≥ objetivo */
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
      const out: Record<string, DayStatus> = {}
      for (let i = 0; i < daysIn; i++) {
        const d = addDays(first, i)
        const f = (food.data ?? []).filter((r) => r.day === d)
        const kcal = f.reduce((a, r) => a + Number(r.kcal), 0)
        const prot = f.reduce((a, r) => a + Number(r.protein), 0)
        const t = (targets.data ?? []).find((r) => r.day === d)
        const tol = Number(profile.kcal_tolerance_pct) / 100
        const diet = !f.length || !t ? null
          : Math.abs(kcal - t.target_kcal) <= t.target_kcal * tol && prot >= t.target_protein * (Number(profile.protein_min_pct) / 100)
        const trained = (wos.data ?? []).some((r) => r.day === d)
        const st = (steps.data ?? []).find((r) => r.day === d)?.steps ?? 0
        const training = d > ymd() ? null : trained || st >= profile.steps_goal
        out[d] = { diet, training, kcal, target: t?.target_kcal ?? null }
      }
      setStatus(out)
    })()
  }, [first, last, daysIn, profile])

  const offset = (new Date(first + 'T12:00:00').getDay() + 6) % 7
  const vals = Object.entries(status).filter(([d]) => d <= ymd())
  const dietOk = vals.filter(([, s]) => s.diet).length
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
            <div key={d} className={`cell ${d === ymd() ? 'today' : ''} ${s?.diet && s?.training ? 'both' : ''}`}
              title={s?.target ? `${Math.round(s.kcal)} / ${s.target} kcal` : undefined}>
              <span className="mono" style={{ opacity: d > ymd() ? 0.35 : 1 }}>{i + 1}</span>
              <div className="dots"><i className={`d ${s?.diet ? 'on' : ''}`} /><i className={`t ${s?.training ? 'on' : ''}`} /></div>
            </div>
          )
        })}
      </div>
      <div className="row between small">
        <span><span style={{ color: 'var(--lime)' }}>●</span> Dieta <b className="mono">{dietOk}</b></span>
        <span><span style={{ color: 'var(--violet)' }}>●</span> Entreno/pasos <b className="mono">{trainOk}</b></span>
        <span className="muted mono">{vals.length ? Math.round(((dietOk + trainOk) / (vals.length * 2)) * 100) : 0}% total</span>
      </div>
    </div>
  )
}
