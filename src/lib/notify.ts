/* ------------------------------------------------------------------ *
 * Delivery channels for notifications
 *
 * The store decides *that* something happened; this decides how it
 * reaches a person who may not be looking at the tab. Three channels,
 * each independently switchable and each degrading quietly when the
 * browser says no.
 * ------------------------------------------------------------------ */

export type Permission = 'default' | 'granted' | 'denied' | 'unsupported'

export function desktopPermission(): Permission {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission as Permission
}

export async function requestDesktop(): Promise<Permission> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission as Permission
  try {
    return (await Notification.requestPermission()) as Permission
  } catch {
    return 'denied'
  }
}

export function showDesktop(title: string, body: string, tag: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    // `tag` collapses repeats so a burst of assignments is one notification.
    const n = new Notification(title, { body, tag, icon: '/favicon.svg', silent: true })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* some browsers require a service worker; nothing to fall back to */
  }
}

/* ------------------------------------------------------------------ *
 * Chime
 *
 * Synthesised rather than shipped as an asset — two notes, short decay,
 * quiet enough to sit under a room. Different intervals carry different
 * news so you can tell an approval from a new assignment without looking.
 * ------------------------------------------------------------------ */

let ctx: AudioContext | null = null

export type Chime = 'arrive' | 'good' | 'warn'

const CHIMES: Record<Chime, number[]> = {
  arrive: [587.33, 880.0],  // D5 → A5, a rising open fifth
  good: [659.25, 987.77],   // E5 → B5, brighter
  warn: [493.88, 415.3],    // B4 → G#4, falling
}

export function playChime(kind: Chime = 'arrive'): void {
  try {
    ctx ??= new AudioContext()
    // Autoplay policy parks the context until a gesture; resume is a no-op otherwise.
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    CHIMES[kind].forEach((freq, i) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.09
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.07, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(start)
      osc.stop(start + 0.45)
    })
  } catch {
    /* no audio device, or the context was blocked — silence is fine */
  }
}

/* ------------------------------------------------------------------ *
 * Cross-tab delivery
 *
 * The workspace lives in one browser, so two tabs are two people as far
 * as the demo is concerned. This is what makes "new work lands" visible
 * without a refresh: the tab that assigns broadcasts, the tab that
 * receives reacts.
 * ------------------------------------------------------------------ */

const CHANNEL = 'flow.sync.v1'

export interface SyncMessage {
  /** Monotonic per-write counter, so a tab ignores its own echo and stale writes. */
  revision: number
  origin: string
  at: number
}

export function openChannel(onMessage: (msg: SyncMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  let channel: BroadcastChannel
  try {
    channel = new BroadcastChannel(CHANNEL)
  } catch {
    return () => {}
  }
  const handler = (e: MessageEvent<SyncMessage>) => {
    if (e.data && typeof e.data.revision === 'number') onMessage(e.data)
  }
  channel.addEventListener('message', handler)
  return () => {
    channel.removeEventListener('message', handler)
    channel.close()
  }
}

export function broadcast(msg: SyncMessage): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage(msg)
    channel.close()
  } catch {
    /* channel unavailable; the other tab picks it up on its next load */
  }
}

/** Stable id for this tab, so a broadcast never bounces back on itself. */
export const TAB_ID = Math.random().toString(36).slice(2, 10)
