import type { AppState } from '@/types'

const KEY = 'flow.state.v1'

/**
 * The session is stored separately so "remember me = off" can be dropped
 * on tab close without touching the rest of the workspace data.
 */
const SESSION_KEY = 'flow.session.v1'

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppState
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.users)) return null
    return parsed
  } catch {
    return null
  }
}

let writeTimer: number | undefined

/**
 * Debounced — typing in a brief shouldn't hit disk on every keystroke.
 * `onWritten` fires after the write lands, which is when other tabs can
 * safely be told to re-read.
 */
export function saveState(state: AppState, onWritten?: () => void): void {
  if (writeTimer) window.clearTimeout(writeTimer)
  writeTimer = window.setTimeout(() => {
    try {
      const { session, ...rest } = state
      localStorage.setItem(KEY, JSON.stringify({ ...rest, session: null }))
      if (session?.remember) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      } else if (session) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
        localStorage.removeItem(SESSION_KEY)
      } else {
        localStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(SESSION_KEY)
      }
      onWritten?.()
    } catch (err) {
      console.warn('[flow] could not persist state', err)
    }
  }, 220)
}

export function loadSession(): AppState['session'] {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      /* ignore malformed session */
    }
  }
  return null
}

export function clearAll(): void {
  localStorage.removeItem(KEY)
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}

/**
 * Not cryptography — it keeps demo passwords out of plain sight in
 * devtools and nothing more. A real deployment authenticates server-side.
 */
export function digest(input: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
