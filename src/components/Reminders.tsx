import { FlaskConical, Scale, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import BodyFatCalculator from './BodyFatCalculator'
import { Sheet, decimalText, num, toast } from './ui'
import { ymd } from '../lib/dates'
import { emit, on } from '../lib/events'
import { REOPEN_AFTER_MS, reminderState } from '../lib/reminders'
import { supabase } from '../lib/supabase'
import { useApp } from '../stores/app'

/**
 * Avisos flotantes en la parte superior: peso en ayunas (diario, desde las 6:00) y % de grasa (cada 3 semanas).
 * Siguen visibles hasta que se introduce el dato o se pulsa la X; la X dura hasta la próxima vez que se abre la app.
 */
export default function Reminders() {
  const profile = useApp((s) => s.profile)
  const [now, setNow] = useState(() => new Date())
  const [hasWeightToday, setHasWeightToday] = useState<boolean | null>(null)
  const [lastBodyFatDay, setLastBodyFatDay] = useState<string | null | undefined>(undefined)
  const [dismissed, setDismissed] = useState({ weight: false, bodyfat: false })
  const [kg, setKg] = useState('')
  const [busy, setBusy] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  const hiddenAt = useRef<number | null>(null)

  const load = useCallback(async () => {
    const today = ymd()
    const [{ data: w }, { data: bf }] = await Promise.all([
      supabase.from('weights').select('day').eq('day', today).maybeSingle(),
      supabase.from('body_fat').select('day').order('day', { ascending: false }).limit(1),
    ])
    setHasWeightToday(!!w)
    setLastBodyFatDay(bf?.[0]?.day ?? null)
  }, [])

  useEffect(() => { if (profile?.id) load() }, [profile?.id, load])

  // reloj (para el cambio de las 6:00 y de día) y "volver a abrir la app" tras un rato en segundo plano
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    const vis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return }
      if (hiddenAt.current && Date.now() - hiddenAt.current >= REOPEN_AFTER_MS) setDismissed({ weight: false, bodyfat: false })
      hiddenAt.current = null
      setNow(new Date())
      load()
    }
    document.addEventListener('visibilitychange', vis)
    const off1 = on('weight-saved', load)
    const off2 = on('bodyfat-saved', load)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); off1(); off2() }
  }, [load])

  // si cambia el día con la app abierta, se vuelve a comprobar
  const today = ymd(now)
  useEffect(() => { if (profile?.id) load() }, [today, profile?.id, load])

  if (!profile) return null
  const st = reminderState({
    now, today, hasWeightToday, lastBodyFatDay,
    remindWeight: profile.remind_weight !== false, remindBodyFat: profile.remind_bodyfat !== false, dismissed,
  })

  async function saveWeight() {
    const v = num(kg)
    if (!v) return
    setBusy(true)
    const { error } = await supabase.from('weights').upsert({ day: ymd(), kg: v })
    setBusy(false)
    if (error) return toast.err(error.message)
    toast('Peso guardado')
    setKg('')
    emit('weight-saved')
  }

  return (
    <>
      {(st.weight || st.bodyfat) && (
        <div className="reminders" role="region" aria-label="Avisos">
          {st.weight && (
            <div className="reminder">
              <div className="row" style={{ gap: 10 }}>
                <div className="reminder-ico"><Scale size={18} /></div>
                <div className="grow">
                  <div className="reminder-title">Peso en ayunas</div>
                  <div className="small muted">Aún no has registrado el peso de hoy.</div>
                </div>
                <button className="btn-icon btn-ghost" aria-label="Cerrar aviso de peso"
                  onClick={() => setDismissed((d) => ({ ...d, weight: true }))}><X size={16} /></button>
              </div>
              <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); saveWeight() }}>
                <input className="mono grow" inputMode="decimal" value={kg} aria-label="Peso en kg"
                  placeholder={profile.weight_kg ? `${profile.weight_kg} kg` : 'kg'}
                  onChange={(e) => setKg(decimalText(e.target.value))} />
                <button className="btn-primary" disabled={!num(kg) || busy}>{busy ? <span className="spin" /> : 'Guardar'}</button>
              </form>
            </div>
          )}
          {st.bodyfat && (
            <div className="reminder">
              <div className="row" style={{ gap: 10 }}>
                <div className="reminder-ico"><FlaskConical size={18} /></div>
                <div className="grow">
                  <div className="reminder-title">% de grasa corporal</div>
                  <div className="small muted">
                    {st.bodyFatDaysAgo == null ? 'Aún no lo has medido nunca.' : `Última medición hace ${st.bodyFatDaysAgo} días.`}
                  </div>
                </div>
                <button className="btn-primary btn-sm" onClick={() => setMeasuring(true)}>Medir</button>
                <button className="btn-icon btn-ghost" aria-label="Cerrar aviso de grasa"
                  onClick={() => setDismissed((d) => ({ ...d, bodyfat: true }))}><X size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      <Sheet open={measuring} onClose={() => setMeasuring(false)} title="Calculadora de % grasa">
        <BodyFatCalculator onSaved={() => { setMeasuring(false); emit('bodyfat-saved') }} />
      </Sheet>
    </>
  )
}
