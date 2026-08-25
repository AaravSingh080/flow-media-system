export const MINUTE = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "3 days ago" / "in 4 hours" — picks the largest sensible unit. */
export function relTime(ts: number, now = Date.now()): string {
  const diff = ts - now
  const abs = Math.abs(diff)
  if (abs < MINUTE) return 'just now'
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), 'minute')
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour')
  if (abs < DAY * 30) return rtf.format(Math.round(diff / DAY), 'day')
  if (abs < DAY * 365) return rtf.format(Math.round(diff / (DAY * 30)), 'month')
  return rtf.format(Math.round(diff / (DAY * 365)), 'year')
}

export function fmtDate(ts: number, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', ...opts }).format(ts)
}

export function fmtDateTime(ts: number): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ts)
}

export function fmtFullDate(ts: number): string {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }).format(ts)
}

/** `<input type="datetime-local">` wants a local-time ISO-ish string. */
export function toLocalInput(ts: number): string {
  const d = new Date(ts)
  const off = d.getTimezoneOffset() * MINUTE
  return new Date(ts - off).toISOString().slice(0, 16)
}

export function fromLocalInput(value: string): number {
  return new Date(value).getTime()
}

export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

/** Compact human span for deadlines: "2d 4h left", "6h overdue". */
export function fmtRemaining(dueAt: number, now = Date.now()): { label: string; overdue: boolean; urgent: boolean } {
  const diff = dueAt - now
  const overdue = diff < 0
  const abs = Math.abs(diff)
  let label: string
  if (abs < HOUR) label = `${Math.max(1, Math.round(abs / MINUTE))}m`
  else if (abs < DAY) label = `${Math.round(abs / HOUR)}h`
  else {
    let d = Math.floor(abs / DAY)
    let h = Math.round((abs % DAY) / HOUR)
    // Rounding the remainder can reach 24; carry it rather than printing "2d 24h".
    if (h === 24) {
      d += 1
      h = 0
    }
    label = h > 0 && d < 5 ? `${d}d ${h}h` : `${d}d`
  }
  return { label: overdue ? `${label} over` : `${label} left`, overdue, urgent: !overdue && diff < DAY }
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function fmtClock(ms: number): string {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
