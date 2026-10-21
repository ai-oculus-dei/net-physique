import { Download, Dumbbell, Salad } from 'lucide-react'
import { useState } from 'react'
import { Seg, Sheet, toast } from './ui'
import { addDays, ymd } from '../lib/dates'
import { buildExportRows, exportHeaders, toCsv, type ExportOptions } from '../lib/exportCsv'
import { loadExportInput } from '../lib/exportData'
import { useApp } from '../stores/app'

/** Descarga el CSV; en el móvil usa el menú de compartir (guardar en Archivos, enviar…) */
async function deliver(csv: string, filename: string) {
  const file = new File([csv], filename, { type: 'text/csv' })
  const touch = window.matchMedia?.('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return } catch (e: any) {
      if (e?.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useApp((s) => s.profile)!
  const [from, setFrom] = useState(() => addDays(ymd(), -29))
  const [to, setTo] = useState(() => ymd())
  const [diet, setDiet] = useState(true)
  const [training, setTraining] = useState(true)
  const [sep, setSep] = useState<ExportOptions['sep']>(',')
  const [busy, setBusy] = useState(false)

  const valid = (diet || training) && from && to && from <= to

  async function run() {
    if (!valid) return
    setBusy(true)
    try {
      const o: ExportOptions = { diet, training, sep }
      const rows = buildExportRows(await loadExportInput(profile, from, to, o), o)
      if (!rows.length) { toast.err('No hay datos en ese intervalo'); return }
      const kind = diet && training ? 'diet-training' : diet ? 'diet' : 'training'
      await deliver(toCsv(exportHeaders(o), rows, sep), `net-physique_${kind}_${from}_${to}.csv`)
      toast(`${rows.length} filas exportadas`)
    } catch (e: any) { toast.err(e.message) } finally { setBusy(false) }
  }

  const presets: [string, number][] = [['7 días', 6], ['30 días', 29], ['90 días', 89], ['1 año', 364]]
  return (
    <Sheet open={open} onClose={onClose} title={<span className="ic"><Download size={18} color="var(--cyan)" /> Exportar CSV</span>}>
      <div className="stack">
        <div className="grid2">
          <label className="field"><span>Desde</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span>Hasta</span><input type="date" value={to} min={from} max={ymd()} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="chips">
          {presets.map(([l, n]) => (
            <button key={l} className={`chip ${to === ymd() && from === addDays(ymd(), -n) ? 'on' : ''}`}
              onClick={() => { setTo(ymd()); setFrom(addDays(ymd(), -n)) }}>{l}</button>
          ))}
        </div>

        <span className="small muted">Datos a exportar</span>
        <div className="grid2">
          <button type="button" className={`export-opt ${diet ? 'on' : ''}`} onClick={() => setDiet(!diet)} aria-pressed={diet}>
            <Salad size={20} /><b>Diet</b>
            <span className="tiny muted">alimentos, kcal, macros, objetivo y peso del día</span>
          </button>
          <button type="button" className={`export-opt ${training ? 'on' : ''}`} onClick={() => setTraining(!training)} aria-pressed={training}>
            <Dumbbell size={20} /><b>Training</b>
            <span className="tiny muted">ejercicios, series, reps, músculos y pasos</span>
          </button>
        </div>

        <div className="row between wrap">
          <span className="small muted">Separador</span>
          <Seg value={sep} onChange={setSep} options={[{ id: ',', label: 'Coma' }, { id: ';', label: 'Punto y coma (Excel)' }]} />
        </div>
        <span className="small faint">Los decimales van con punto. Si abres el archivo con Excel en español, elige «Punto y coma».</span>

        <button className="btn-primary" disabled={!valid || busy} onClick={run}>
          {busy ? <span className="spin" /> : <><Download size={17} /> Descargar CSV</>}
        </button>
      </div>
    </Sheet>
  )
}
