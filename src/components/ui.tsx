import { useEffect, useState, type ReactNode } from 'react'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {title && (
          <div className="row between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
            <button className="btn-icon btn-ghost" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

let pushToast: (m: string) => void = () => {}
export const toast = (m: string) => pushToast(m)

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let t: number | undefined
    pushToast = (m) => { setMsg(m); clearTimeout(t); t = window.setTimeout(() => setMsg(null), 2400) }
  }, [])
  return msg ? <div className="toast">{msg}</div> : null
}

export function Ring({ value, max, size = 168, stroke = 12, children }: {
  value: number; max: number; size?: number; stroke?: number; children: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? value / max : 0
  const over = pct > 1.1
  const cx = size / 2
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--cyan)" /><stop offset="1" stopColor="var(--violet)" />
          </linearGradient>
        </defs>
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * 2 * Math.PI - Math.PI / 2
          const r1 = r - stroke / 2 - 6
          const r2 = r1 - (i % 6 === 0 ? 7 : 3)
          return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cx + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cx + r2 * Math.sin(a)}
            stroke={i / 48 <= Math.min(pct, 1) ? 'var(--cyan)' : 'var(--line-strong)'} strokeWidth={1} opacity={0.8} />
        })}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--bg-2)" strokeWidth={stroke} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={over ? 'var(--bad)' : 'url(#ringg)'}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${Math.min(pct, 1) * c} ${c}`}
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 0 6px rgba(34,211,238,.45))' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  )
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className={`bar ${pct > 105 ? 'over' : ''}`}>
      <i style={{ width: `${Math.min(pct, 100)}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
    </div>
  )
}

export function Empty({ emoji, children }: { emoji: string; children: ReactNode }) {
  return <div className="empty"><span className="big">{emoji}</span>{children}</div>
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)} type="button">{o.label}</button>
      ))}
    </div>
  )
}

export const r0 = (n: number | null | undefined) => Math.round(Number(n ?? 0))
export const r1 = (n: number | null | undefined) => Math.round(Number(n ?? 0) * 10) / 10
export const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
