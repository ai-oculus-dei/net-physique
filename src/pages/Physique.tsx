import { Brain, CalendarCheck, Camera, Dna, FlaskConical, Scale, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import BodyFatCalculator from '../components/BodyFatCalculator'
import ComplianceCalendar from '../components/ComplianceCalendar'
import ProgressPhotos from '../components/ProgressPhotos'
import WeightChart, { weeklyAverages, type WeightRow } from '../components/WeightChart'
import { Seg, Sheet, num, r1, toast } from '../components/ui'
import { addDays, fmtDay, weekStart, ymd } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { useDayEnergy } from '../lib/useDayEnergy'
import { useApp } from '../stores/app'

type Range = '30' | '90' | '365'

export default function Physique() {
  const { profile, saveProfile } = useApp()
  const [range, setRange] = useState<Range>('90')
  const [rows, setRows] = useState<WeightRow[]>([])
  const [fat, setFat] = useState<{ day: string; pct: number; method: string }[]>([])
  const [bfOpen, setBfOpen] = useState(false)
  const [kgInput, setKgInput] = useState('')
  const { energy } = useDayEnergy(ymd())

  const load = useCallback(async () => {
    const [{ data: w }, { data: f }] = await Promise.all([
      supabase.from('weights').select('day,kg').gte('day', addDays(ymd(), -Number(range))).order('day'),
      supabase.from('body_fat').select('day,pct,method').order('day', { ascending: false }).limit(5),
    ])
    setRows((w ?? []) as WeightRow[])
    setFat((f ?? []) as any)
  }, [range])
  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const wk = weeklyAverages(rows)
    const thisW = wk.find((x) => x.week === weekStart(ymd()))
    const lastW = wk.find((x) => x.week === addDays(weekStart(ymd()), -7))
    const today = rows.find((r) => r.day === ymd())
    return { thisW, lastW, today, delta: thisW && lastW ? thisW.avg - lastW.avg : null }
  }, [rows])

  async function saveWeight() {
    const v = num(kgInput)
    if (!v) return
    const { error } = await supabase.from('weights').upsert({ day: ymd(), kg: v })
    error ? toast.err(error.message) : toast('Peso guardado')
    setKgInput(''); load()
  }

  const goal = profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null
  const ref = stats.thisW?.avg ?? stats.lastW?.avg ?? null
  const weeksToGoal = goal && ref && stats.delta && Math.sign(goal - ref) === Math.sign(stats.delta)
    ? Math.abs((goal - ref) / stats.delta) : null

  const suggested = energy?.suggestedFactor
  const showFactor = profile && profile.energy_mode !== 'dynamic' && suggested
    && Math.abs(suggested - Number(profile.activity_factor)) > 0.05

  return (
    <div className="shell">
      <div className="topbar">
        <div>
          <h1><Dna size={22} /> Physique</h1>
          <div className="sub">{fat[0] ? `${r1(fat[0].pct)} % grasa · ${fmtDay(fat[0].day, { day: 'numeric', month: 'short' })}` : 'sin % grasa'}</div>
        </div>
        <button className="btn-sm" onClick={() => setBfOpen(true)}><FlaskConical size={15} /> % grasa</button>
      </div>

      <div className="stack">
        <div className="card glow">
          <h2><Scale size={14} /> Peso de referencia</h2>
          <div className="grid3">
            <div className="kpi">
              <span className="v" style={{ color: 'var(--cyan)' }}>{stats.thisW ? r1(stats.thisW.avg) : '--'}</span>
              <span className="l">media semana ({stats.thisW?.n ?? 0}d)</span>
            </div>
            <div className="kpi">
              <span className={`v ${stats.delta == null ? '' : (goal && Math.sign(goal - (ref ?? 0)) === Math.sign(stats.delta)) ? 'ok' : 'warn'}`}>
                {stats.delta == null ? '--' : (stats.delta > 0 ? '+' : '') + r1(stats.delta)}
              </span>
              <span className="l">vs semana ant.</span>
            </div>
            <div className="kpi">
              <span className="v">{goal ?? '--'}</span>
              <span className="l">{weeksToGoal ? `objetivo · ~${Math.ceil(weeksToGoal)} sem` : 'objetivo'}</span>
            </div>
          </div>
          {!stats.today && (
            <div className="row" style={{ marginTop: 12 }}>
              <input className="mono grow" inputMode="decimal" placeholder="Peso en ayunas de hoy" value={kgInput} onChange={(e) => setKgInput(e.target.value)} />
              <button className="btn-primary" onClick={saveWeight}>Guardar</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="row between" style={{ marginBottom: 6 }}>
            <h2 style={{ margin: 0 }}><TrendingUp size={14} /> Evolución</h2>
            <Seg value={range} onChange={setRange} options={[{ id: '30', label: '30d' }, { id: '90', label: '90d' }, { id: '365', label: '1a' }]} />
          </div>
          {rows.length > 1 ? <WeightChart rows={rows} goal={goal} /> : <div className="empty">Registra al menos 2 días de peso.</div>}
          <div className="row small muted" style={{ gap: 14, justifyContent: 'center' }}>
            <span><span className="faint">●</span> diario</span>
            <span style={{ color: 'var(--cyan)' }}>━ tendencia</span>
            <span style={{ color: 'var(--violet)' }}>┅ media semanal</span>
          </div>
        </div>

        {showFactor && (
          <div className="card" style={{ borderColor: 'var(--amber)' }}>
            <h2><Brain size={14} /> Factor de actividad adaptativo</h2>
            <p className="small" style={{ marginTop: 0 }}>
              Con tus pasos y entrenos de los últimos 14 días, tu factor real es <b className="mono">×{suggested}</b> (ahora usas <span className="mono">×{profile!.activity_factor}</span>).
            </p>
            <button className="btn-primary btn-sm" onClick={async () => { await saveProfile({ activity_factor: suggested! }); toast('Factor actualizado') }}>
              Aplicar ×{suggested}
            </button>
          </div>
        )}

        <div className="card">
          <h2><CalendarCheck size={14} /> Cumplimiento de objetivos</h2>
          <ComplianceCalendar />
        </div>

        {fat.length > 0 && (
          <div className="card">
            <h2><FlaskConical size={14} /> Historial % grasa</h2>
            <div className="list">
              {fat.map((f, i) => (
                <div key={i} className="list-item">
                  <span className="grow">{fmtDay(f.day)}</span>
                  <span className="tag">{f.method}</span>
                  <span className="mono">{r1(f.pct)} %</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h2><Camera size={14} /> Fotos de progreso <span className="faint">· privadas</span></h2>
          <ProgressPhotos />
        </div>
      </div>

      <Sheet open={bfOpen} onClose={() => setBfOpen(false)} title="Calculadora de % grasa">
        <BodyFatCalculator onSaved={() => { setBfOpen(false); load() }} />
      </Sheet>
    </div>
  )
}
