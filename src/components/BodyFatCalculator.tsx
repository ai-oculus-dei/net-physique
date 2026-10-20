import { useState } from 'react'
import { num, r1, toast } from './ui'
import { ageFromBirthdate, navyBodyFat, skinfoldBodyFat } from '../lib/formulas'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/dates'
import { useApp } from '../stores/app'

type Method = 'jp3' | 'jp7' | 'navy' | 'bia_foot' | 'bia_hand'

const SITES = {
  jp3: { male: ['Pecho', 'Abdomen', 'Muslo'], female: ['Tríceps', 'Suprailíaco', 'Muslo'] },
  jp7: {
    male: ['Pecho', 'Axilar media', 'Tríceps', 'Subescapular', 'Abdomen', 'Suprailíaco', 'Muslo'],
    female: ['Pecho', 'Axilar media', 'Tríceps', 'Subescapular', 'Abdomen', 'Suprailíaco', 'Muslo'],
  },
}

export default function BodyFatCalculator({ onSaved }: { onSaved: () => void }) {
  const profile = useApp((s) => s.profile)!
  const sex = profile.sex ?? 'male'
  const [method, setMethod] = useState<Method>('navy')
  const [v, setV] = useState<Record<string, string>>({})
  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: e.target.value }))
  const age = profile.birthdate ? ageFromBirthdate(profile.birthdate) : 30
  const height = Number(profile.height_cm ?? 170)

  let pct: number | null = null
  if (method === 'jp3' || method === 'jp7') {
    const sites = SITES[method][sex]
    const folds = sites.map((x) => num(v[x] ?? ''))
    if (folds.every((f) => f != null && f > 0)) pct = skinfoldBodyFat(method, sex, folds as number[], age)
  } else if (method === 'navy') {
    const neck = num(v.neck ?? ''), waist = num(v.waist ?? ''), hip = num(v.hip ?? '')
    if (neck && waist && (sex === 'male' || hip)) pct = navyBodyFat(sex, height, neck, waist, hip ?? 0)
  } else {
    pct = num(v.bia ?? '')
  }
  const valid = pct != null && Number.isFinite(pct) && pct > 2 && pct < 70

  async function save() {
    if (!valid) return
    const { error } = await supabase.from('body_fat').insert({ day: ymd(), method, inputs: v, pct: r1(pct) })
    if (error) return toast('⚠️ ' + error.message)
    toast(`🧬 ${r1(pct)} % guardado`)
    setV({})
    onSaved()
  }

  return (
    <div className="stack">
      <div className="chips">
        {([['navy', '📏 Cinta (Navy)'], ['jp3', '🤏 Pliegues 3'], ['jp7', '🤏 Pliegues 7'], ['bia_foot', '⚖️ Báscula pie'], ['bia_hand', '✋ Impedancia mano']] as [Method, string][])
          .map(([id, l]) => <button key={id} className={`chip ${method === id ? 'on' : ''}`} onClick={() => { setMethod(id); setV({}) }}>{l}</button>)}
      </div>

      {(method === 'jp3' || method === 'jp7') && (
        <>
          <span className="small faint">Pliegues en mm, lado derecho, media de 2-3 tomas. Jackson-Pollock + Siri.</span>
          <div className="grid3">
            {SITES[method][sex].map((x) => (
              <label key={x} className="field"><span>{x}</span><input inputMode="decimal" value={v[x] ?? ''} onChange={s(x)} /></label>
            ))}
          </div>
        </>
      )}
      {method === 'navy' && (
        <>
          <span className="small faint">Medidas en cm. Cintura a la altura del ombligo{sex === 'female' ? '; cadera en la parte más ancha' : ''}. Altura: {height} cm.</span>
          <div className="grid3">
            <label className="field"><span>Cuello</span><input inputMode="decimal" value={v.neck ?? ''} onChange={s('neck')} /></label>
            <label className="field"><span>Cintura</span><input inputMode="decimal" value={v.waist ?? ''} onChange={s('waist')} /></label>
            {sex === 'female' && <label className="field"><span>Cadera</span><input inputMode="decimal" value={v.hip ?? ''} onChange={s('hip')} /></label>}
          </div>
        </>
      )}
      {(method === 'bia_foot' || method === 'bia_hand') && (
        <label className="field"><span>% grasa que marca el dispositivo</span>
          <input inputMode="decimal" value={v.bia ?? ''} onChange={s('bia')} />
        </label>
      )}

      <div className="row between">
        <div className="kpi">
          <span className="v" style={{ color: valid ? 'var(--cyan)' : 'var(--faint)' }}>{valid ? r1(pct) : '--.-'}<span className="muted" style={{ fontSize: 14 }}> %</span></span>
          <span className="l">grasa corporal</span>
        </div>
        <button className="btn-primary" disabled={!valid} onClick={save}>Guardar</button>
      </div>
    </div>
  )
}
