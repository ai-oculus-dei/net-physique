import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, TriangleAlert, X, type LucideIcon } from 'lucide-react'

// Pila de hojas abiertas: Escape y el bloqueo de scroll solo afectan a la de arriba
const sheetStack: number[] = []
let sheetSeq = 0

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const id = ++sheetSeq
    sheetStack.push(id)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && sheetStack[sheetStack.length - 1] === id && closeRef.current()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      sheetStack.splice(sheetStack.indexOf(id), 1)
      if (!sheetStack.length) document.body.style.overflow = ''
    }
  }, [open])
  useEffect(() => { if (!open) setDrag(0) }, [open])

  if (!open) return null

  // Deslizar hacia abajo desde la pestaña/cabecera para cerrar
  const dragHandlers = {
    onTouchStart: (e: React.TouchEvent) => { startY.current = e.touches[0].clientY },
    onTouchMove: (e: React.TouchEvent) => {
      if (startY.current == null) return
      setDrag(Math.max(0, e.touches[0].clientY - startY.current))
    },
    onTouchEnd: () => {
      const d = drag
      startY.current = null
      setDrag(0)
      if (d > 90) onClose()
    },
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}>
        <div className="sheet-head" {...dragHandlers}>
          <div className="grab" />
          {title && (
            <div className="row between">
              <h3 style={{ margin: 0, fontSize: 17 }} className="ellipsis">{title}</h3>
              <button className="btn-icon btn-ghost" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

type ToastKind = 'ok' | 'err'
let pushToast: (m: string, k: ToastKind) => void = () => {}
export const toast = Object.assign((m: string) => pushToast(m, 'ok'), { err: (m: string) => pushToast(m, 'err') })

export function Toaster() {
  const [msg, setMsg] = useState<{ m: string; k: ToastKind } | null>(null)
  useEffect(() => {
    let t: number | undefined
    pushToast = (m, k) => { setMsg({ m, k }); clearTimeout(t); t = window.setTimeout(() => setMsg(null), 2400) }
  }, [])
  if (!msg) return null
  return (
    <div className={`toast ${msg.k}`}>
      {msg.k === 'ok' ? <CircleCheck size={17} /> : <TriangleAlert size={17} />}
      <span>{msg.m}</span>
    </div>
  )
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

export function Empty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <div className="empty"><span className="big"><Icon size={30} strokeWidth={1.5} /></span>{children}</div>
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
