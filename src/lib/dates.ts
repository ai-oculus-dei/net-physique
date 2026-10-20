// Fechas en zona local, formato YYYY-MM-DD

export function ymd(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/** Lunes de la semana del día dado */
export function weekStart(day: string): string {
  const d = new Date(day + 'T12:00:00')
  const dow = (d.getDay() + 6) % 7
  return addDays(day, -dow)
}

export function fmtDay(day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(day + 'T12:00:00').toLocaleDateString('es-ES', opts)
}

export function hhmm(ts: string) {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
