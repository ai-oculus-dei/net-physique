import { Scale } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/dates'
import { useApp } from '../stores/app'
import { Sheet, decimalText, num, toast } from './ui'

const SKIP_KEY = 'np-weight-skip'

/** Pide el peso en ayunas la primera vez que se abre la app cada día */
export default function DailyWeightPrompt() {
  const profile = useApp((s) => s.profile)
  const [open, setOpen] = useState(false)
  const [kg, setKg] = useState('')

  useEffect(() => {
    const today = ymd()
    try { if (localStorage.getItem(SKIP_KEY) === today) return } catch { /* sin storage */ }
    supabase.from('weights').select('day').eq('day', today).maybeSingle().then(({ data }) => {
      if (!data) { setKg(profile?.weight_kg ? String(profile.weight_kg) : ''); setOpen(true) }
    })
  }, [profile?.id])

  function close() {
    try { localStorage.setItem(SKIP_KEY, ymd()) } catch { /* sin storage */ }
    setOpen(false)
  }

  async function save() {
    const v = num(kg)
    if (!v) return
    const { error } = await supabase.from('weights').upsert({ day: ymd(), kg: v })
    if (error) return toast.err(error.message)
    toast('Peso guardado')
    close()
  }

  return (
    <Sheet open={open} onClose={close} title={<span className="ic"><Scale size={18} color="var(--cyan)" /> Peso en ayunas</span>}>
      <div className="stack">
        <p className="muted small" style={{ margin: 0 }}>Después de ir al baño y antes de comer o beber. Se usa la media semanal como referencia.</p>
        <input className="mono" style={{ fontSize: 28, textAlign: 'center' }} inputMode="decimal" autoFocus
          value={kg} onChange={(e) => setKg(decimalText(e.target.value))} placeholder="00.0" />
        <div className="grid2">
          <button className="btn-ghost" onClick={close}>Hoy no</button>
          <button className="btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </Sheet>
  )
}
