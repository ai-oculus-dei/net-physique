import { Activity, Gauge, Scale } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  BALANCE_MIN_DAYS, BALANCE_WINDOW_DAYS, EXTREME_HIGH, EXTREME_LOW, IN_RANGE_PCT, MIN_WEIGHINGS, OFF_PCT, RULER_PCT,
  computeBalance, computeWeightTrend, rulerPosition, type BalanceResult, type BalanceStatus, type WeightTrend,
} from '../lib/balance'
import { loadBalanceInput } from '../lib/balanceData'
import { fmtDay, ymd } from '../lib/dates'
import { useApp } from '../stores/app'
import { r0, r1 } from './ui'

const LIGHTS: { s: BalanceStatus; cls: string; label: string }[] = [
  { s: 'ok', cls: 'blue', label: 'En rango' },
  { s: 'warn', cls: 'orange', label: 'Algo desviado' },
  { s: 'off', cls: 'red', label: 'Fuera de rango' },
]

// Textos descriptivos y neutros: informan, no juzgan
function statusText(b: BalanceResult): { title: string; desc: string; cls: string } {
  const dir = b.direction === 'above' ? 'por encima' : 'por debajo'
  switch (b.status) {
    case 'ok': return { title: 'En rango', cls: 'blue', desc: 'La media de la semana está cerca del objetivo.' }
    case 'warn': return { title: `Algo desviado · ${dir}`, cls: 'orange', desc: `La media semanal queda algo ${dir} del objetivo.` }
    case 'off': return { title: `Fuera de rango · ${dir}`, cls: 'red', desc: 'Vale la pena mirar con calma cómo ha ido esta semana.' }
    default: return {
      title: 'Pocos datos', cls: 'gray',
      desc: `Con ${BALANCE_MIN_DAYS} días registrados de los últimos ${BALANCE_WINDOW_DAYS} aparece el balance (ahora ${b.days}).`,
    }
  }
}

/** Regla −25 % … +25 % con zonas y marcador */
function Ruler({ deviation, status }: { deviation: number | null; status: BalanceStatus }) {
  const pct = (v: number) => ((v + RULER_PCT) / (2 * RULER_PCT)) * 100
  const a = pct(-OFF_PCT), b = pct(-IN_RANGE_PCT), c = pct(IN_RANGE_PCT), d = pct(OFF_PCT)
  const zones = `linear-gradient(90deg,
    var(--sem-red) 0 ${a}%, var(--sem-orange) ${a}% ${b}%, var(--sem-blue) ${b}% ${c}%,
    var(--sem-orange) ${c}% ${d}%, var(--sem-red) ${d}% 100%)`
  const ticks = [-RULER_PCT, -OFF_PCT, -IN_RANGE_PCT, 0, IN_RANGE_PCT, OFF_PCT, RULER_PCT]
  const show = deviation != null && status !== 'nodata'
  const pos = show ? rulerPosition(deviation!) : 50
  const clipped = show && Math.abs(deviation!) > RULER_PCT
  return (
    <div className="ruler">
      <div className="ruler-track" style={{ background: zones }} />
      {show && (
        <div className={`ruler-marker ${status} ${pos < 12 ? 'edge-l' : pos > 88 ? 'edge-r' : ''}`} style={{ left: `${pos}%` }}>
          <span className="mono">{clipped ? (deviation! > 0 ? '›' : '‹') : ''}{deviation! > 0 ? '+' : ''}{r1(deviation)}%</span>
        </div>
      )}
      <div className="ruler-ticks mono">
        {ticks.map((t) => <span key={t} style={{ left: `${pct(t)}%` }}>{t > 0 ? `+${t}` : t}</span>)}
      </div>
    </div>
  )
}

function WeightBlock({ t }: { t: WeightTrend }) {
  if (!t.enough) {
    return (
      <div className="balance-row muted small">
        <Scale size={14} /> Tendencia de peso: faltan pesajes
        <span className="mono faint"> ({t.recentCount}/{MIN_WEIGHINGS} esta semana · {t.previousCount}/{MIN_WEIGHINGS} la anterior)</span>
      </div>
    )
  }
  const sign = (n: number) => (n > 0 ? '+' : '') + r1(n)
  return (
    <div className="balance-row small">
      <Scale size={14} />
      <span>
        Peso medio <b className="mono">{r1(t.recent)} kg</b>
        <span className="muted"> vs {r1(t.previous)} kg la semana anterior · </span>
        <b className="mono">{sign(t.deltaKg!)} kg/semana</b>
      </span>
    </div>
  )
}

export default function BalanceCard({ refreshKey }: { refreshKey?: unknown }) {
  const profile = useApp((s) => s.profile)
  const [data, setData] = useState<{ b: BalanceResult; w: WeightTrend } | null>(null)

  useEffect(() => {
    if (!profile) return
    const today = ymd()
    loadBalanceInput(profile, today)
      .then(({ days, weights }) => setData({ b: computeBalance(days, today), w: computeWeightTrend(weights, today) }))
      .catch(() => setData(null))
  }, [profile, refreshKey])

  if (!data) return null
  return <BalanceView b={data.b} w={data.w} />
}

/** Pinta la tarjeta a partir de los resultados ya calculados */
export function BalanceView({ b, w }: { b: BalanceResult; w: WeightTrend }) {
  const st = statusText(b)
  const range = `${fmtDay(b.from, { day: 'numeric', month: 'short' })} – ${fmtDay(b.to, { day: 'numeric', month: 'short' })}`
  return (
    <div className={`card balance ${st.cls}`}>
      <div className="row between">
        <h2 style={{ margin: 0 }}><Gauge size={14} /> Balance 7 días</h2>
        <span className="tiny faint mono">{range}</span>
      </div>

      <div className="row" style={{ gap: 14, marginTop: 12 }}>
        <div className="lights" aria-hidden>
          {LIGHTS.map((l) => <i key={l.s} className={`light ${l.cls} ${b.status === l.s ? 'on' : ''}`} />)}
        </div>
        <div className="grow">
          <div className={`balance-title ${st.cls}`}>{st.title}</div>
          <div className="small muted">{st.desc}</div>
        </div>
      </div>

      {b.days > 0 && (
        <div className="grid2 balance-kpis">
          <div className="kpi"><span className="v">{r0(b.avgConsumed)}</span><span className="l">kcal media diaria</span></div>
          <div className="kpi">
            <span className={`v balance-dev ${st.cls}`}>{b.deviation! > 0 ? '+' : ''}{r1(b.deviation)}%</span>
            <span className="l">desviación</span>
          </div>
          <div className="kpi"><span className="v">{r0(b.avgTarget)}</span><span className="l">objetivo medio</span></div>
          <div className="kpi"><span className="v">{b.days}<span className="muted" style={{ fontSize: 14 }}>/{BALANCE_WINDOW_DAYS}</span></span><span className="l">días registrados</span></div>
        </div>
      )}

      <Ruler deviation={b.deviation} status={b.status} />

      {b.days > 0 && (
        <div className="balance-row small">
          <Activity size={14} />
          <span>
            <b className="mono">{b.extremeDays}</b> de <b className="mono">{b.days}</b> días con mucha diferencia
            <span className="faint"> (&lt;{r0(EXTREME_LOW * 100)}% o &gt;{r0(EXTREME_HIGH * 100)}% de su objetivo)</span>
          </span>
        </div>
      )}

      <WeightBlock t={w} />
    </div>
  )
}
