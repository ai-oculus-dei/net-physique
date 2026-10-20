import { addDays, fmtDay, ymd } from '../lib/dates'

export default function DayPicker({ day, onChange, allowFuture }: { day: string; onChange: (d: string) => void; allowFuture?: boolean }) {
  const today = ymd()
  return (
    <div className="row" style={{ gap: 4 }}>
      <button className="btn-icon btn-ghost" onClick={() => onChange(addDays(day, -1))} aria-label="Día anterior">‹</button>
      <button className="btn-ghost btn-sm mono" onClick={() => onChange(today)} style={{ minWidth: 92 }}>
        {day === today ? 'HOY' : fmtDay(day)}
      </button>
      <button className="btn-icon btn-ghost" onClick={() => onChange(addDays(day, 1))} disabled={!allowFuture && day >= today}aria-label="Día siguiente">›</button>
    </div>
  )
}
