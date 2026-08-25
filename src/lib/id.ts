const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Short, sortable-enough, collision-safe-enough id for local data. */
export function uid(prefix = ''): string {
  const time = Date.now().toString(36)
  let rand = ''
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (const b of bytes) rand += ALPHABET[b % ALPHABET.length]
  return `${prefix}${prefix ? '_' : ''}${time}${rand}`
}

export function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0')
}
