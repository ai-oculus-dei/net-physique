import { muscleEs } from '../lib/muscles'

// Silueta segmentada (vista frontal y trasera). Las formas se definen para el lado
// izquierdo y se reflejan. viewBox 120×250.
type Shape = { m: string; d: string }

const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`
const poly = (pts: string) => `M${pts}Z`

const FRONT: Shape[] = [
  { m: 'neck', d: poly('55,31 60,31 60,40 54,40') },
  { m: 'traps', d: poly('54,36 43,43 54,42') },
  { m: 'shoulders', d: ell(38, 49, 8.5, 8) },
  { m: 'chest', d: 'M43,44 h16 v18 q-8,4 -16,-2 q-3,-8 0,-16Z' },
  { m: 'biceps', d: ell(31.5, 67, 5.5, 11) },
  { m: 'forearms', d: ell(26, 94, 5, 13.5) },
  { m: 'abdominals', d: 'M48,65 h11 v40 q-6,3 -11,-4Z' },
  { m: 'abductors', d: ell(41, 112, 4.5, 9) },
  { m: 'adductors', d: 'M52,117 q7,4 7,8 l-2,28 q-6,-12 -5,-36Z' },
  { m: 'quadriceps', d: 'M40,122 q8,-6 12,-1 q2,18 -1,38 q-5,6 -9,0 q-5,-18 -2,-37Z' },
  { m: 'calves', d: ell(45, 191, 5.5, 18) },
]

const BACK: Shape[] = [
  { m: 'neck', d: poly('55,31 60,31 60,38 54,38') },
  { m: 'traps', d: poly('60,34 44,43 52,48 60,62') },
  { m: 'shoulders', d: ell(38, 49, 8.5, 8) },
  { m: 'triceps', d: ell(31.5, 67, 5.5, 11) },
  { m: 'forearms', d: ell(26, 94, 5, 13.5) },
  { m: 'lats', d: poly('44,55 52,50 52,82 47,88 43,70') },
  { m: 'middle back', d: poly('53,50 59,62 59,82 53,82') },
  { m: 'lower back', d: 'M50,86 h9 v17 h-11 q0,-10 2,-17Z' },
  { m: 'glutes', d: ell(50, 117, 9.5, 10.5) },
  { m: 'abductors', d: ell(38.5, 111, 3.5, 8) },
  { m: 'hamstrings', d: 'M41,130 q8,-4 13,0 q1,18 -2,32 q-5,4 -9,0 q-4,-14 -2,-32Z' },
  { m: 'calves', d: ell(46, 188, 7, 17) },
]

// Volumen semanal (series): 0 · 1-4 · 5-9 · 10-14 · 15-20 · >20
export const HEAT_STOPS = [
  { min: 0, c: 'var(--heat-0)', l: '0' },
  { min: 0.5, c: '#155e75', l: '1-4' },
  { min: 5, c: '#0891b2', l: '5-9' },
  { min: 10, c: '#22d3ee', l: '10-14' },
  { min: 15, c: '#a78bfa', l: '15-20' },
  { min: 20.5, c: '#fb7185', l: '>20' },
]
export const heatColor = (v: number) => [...HEAT_STOPS].reverse().find((s) => v >= s.min)!.c

function View({ shapes, load, label, onPick }: { shapes: Shape[]; load: Record<string, number>; label: string; onPick?: (m: string) => void }) {
  const draw = (s: Shape, mirror: boolean, i: number) => {
    const v = load[s.m] ?? 0
    return (
      <path key={`${s.m}-${mirror}-${i}`} d={s.d} transform={mirror ? 'translate(120,0) scale(-1,1)' : undefined}
        fill={heatColor(v)} stroke="var(--bg)" strokeWidth={1.2} style={{ cursor: onPick ? 'pointer' : undefined, transition: 'fill .4s' }}
        onClick={() => onPick?.(s.m)}>
        <title>{muscleEs(s.m)}: {Math.round(v * 10) / 10} series</title>
      </path>
    )
  }
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <svg viewBox="0 0 120 250" style={{ width: '100%', maxWidth: 150, height: 'auto' }}>
        <circle cx={60} cy={17} r={11} fill="var(--heat-0)" />
        {shapes.map((s, i) => draw(s, false, i))}
        {shapes.map((s, i) => draw(s, true, i))}
        {/* pies/rodillas */}
        <rect x={39} y={163} width={12} height={6} rx={3} fill="var(--heat-0)" />
        <rect x={69} y={163} width={12} height={6} rx={3} fill="var(--heat-0)" />
        <rect x={39} y={214} width={12} height={8} rx={4} fill="var(--heat-0)" />
        <rect x={69} y={214} width={12} height={8} rx={4} fill="var(--heat-0)" />
      </svg>
      <div className="tiny faint">{label}</div>
    </div>
  )
}

export default function BodyHeatmap({ load, onPick }: { load: Record<string, number>; onPick?: (m: string) => void }) {
  const top = Object.entries(load).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <View shapes={FRONT} load={load} label="FRONTAL" onPick={onPick} />
        <View shapes={BACK} load={load} label="POSTERIOR" onPick={onPick} />
      </div>
      <div className="row" style={{ gap: 4, justifyContent: 'center' }}>
        {HEAT_STOPS.map((s) => (
          <div key={s.l} style={{ textAlign: 'center' }}>
            <div style={{ width: 30, height: 6, borderRadius: 3, background: s.c }} />
            <div className="tiny faint mono" style={{ fontSize: 9 }}>{s.l}</div>
          </div>
        ))}
      </div>
      {top.length > 0 && (
        <div className="chips" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {top.map(([m, v]) => (
            <span key={m} className="tag" style={{ borderColor: heatColor(v) }}>{muscleEs(m)} {Math.round(v * 10) / 10}</span>
          ))}
        </div>
      )}
    </div>
  )
}
