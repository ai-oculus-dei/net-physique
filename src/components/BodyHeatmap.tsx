import { useMemo } from 'react'
import Body, { type ExtendedBodyPart, type Slug } from 'react-muscle-highlighter'
import { cssVar } from './EChart'
import { muscleEs } from '../lib/muscles'
import { useApp } from '../stores/app'

// Músculos de free-exercise-db → zonas del modelo anatómico (react-muscle-highlighter, MIT).
// Cada zona toma la carga máxima de sus músculos de origen.
const SLUG_SOURCES: Partial<Record<Slug, string[]>> = {
  chest: ['chest'],
  abs: ['abdominals'],
  obliques: ['abdominals'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  neck: ['neck'],
  trapezius: ['traps'],
  deltoids: ['shoulders'],
  'upper-back': ['lats', 'middle back'],
  'lower-back': ['lower back'],
  forearm: ['forearms'],
  gluteal: ['glutes', 'abductors'],
  adductors: ['adductors'],
  quadriceps: ['quadriceps'],
  hamstring: ['hamstrings'],
  calves: ['calves'],
}

const REST_SLUGS: Slug[] = ['head', 'hair', 'hands', 'feet', 'knees', 'ankles', 'tibialis']

// Volumen semanal (series): 0 · 1-4 · 5-9 · 10-14 · 15-20 · >20 — de verde a rojo
export const HEAT_STOPS = [
  { min: 0, c: '', l: '0' },
  { min: 0.5, c: '#22c55e', l: '1-4' },
  { min: 5, c: '#a3e635', l: '5-9' },
  { min: 10, c: '#facc15', l: '10-14' },
  { min: 15, c: '#f97316', l: '15-20' },
  { min: 20.5, c: '#ef4444', l: '>20' },
]
const neutral = () => cssVar('--heat-0')
export const heatColor = (v: number) => [...HEAT_STOPS].reverse().find((s) => v >= s.min)!.c || neutral()

export default function BodyHeatmap({ load, onPick }: { load: Record<string, number>; onPick?: (m: string) => void }) {
  const theme = useApp((s) => s.theme)
  const gender = useApp((s) => s.profile?.sex) === 'female' ? 'female' : 'male'

  // El modelo trae un gris fijo por zona: se fija el color de todas para respetar el tema
  const data = useMemo<ExtendedBodyPart[]>(() => {
    const muscles = (Object.entries(SLUG_SOURCES) as [Slug, string[]][]).map(([slug, src]) => {
      const v = Math.max(0, ...src.map((m) => load[m] ?? 0))
      return { slug, styles: { fill: heatColor(v) } }
    })
    const silhouette = cssVar('--faint')
    const rest = REST_SLUGS.map((slug) => ({ slug, styles: { fill: slug === 'head' || slug === 'hair' ? silhouette : neutral() } }))
    return [...muscles, ...rest]
  }, [load, theme])

  const common = {
    data,
    gender,
    border: cssVar('--line-strong'),
    defaultFill: neutral(),
    defaultStroke: cssVar('--bg'),
    defaultStrokeWidth: 1.5,
    onBodyPartPress: (b: ExtendedBodyPart) => {
      const m = b.slug && SLUG_SOURCES[b.slug]?.[0]
      if (m && onPick) onPick(m)
    },
  } as const

  const top = Object.entries(load).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="body-map" key={theme}>
        <div><Body {...common} side="front" /><div className="tiny faint">FRONTAL</div></div>
        <div><Body {...common} side="back" /><div className="tiny faint">POSTERIOR</div></div>
      </div>
      <div className="row" style={{ gap: 4, justifyContent: 'center' }}>
        {HEAT_STOPS.map((s) => (
          <div key={s.l} style={{ textAlign: 'center' }}>
            <div style={{ width: 30, height: 6, borderRadius: 3, background: s.c || 'var(--heat-0)' }} />
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
