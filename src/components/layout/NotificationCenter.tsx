import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Clock, Inbox, MessageSquare, Sparkles, X } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { playChime, showDesktop, type Chime } from '@/lib/notify'
import type { Notification } from '@/types'

/* ------------------------------------------------------------------ *
 * Arrival
 *
 * The store records that something happened; this is what makes a
 * person notice. Four channels — a card that slides in over the work, a
 * chime, an OS notification when the tab is in the background, and an
 * unread count in the tab title. Each is switchable in Settings and
 * each fails quietly when the browser says no.
 * ------------------------------------------------------------------ */

const TTL = 7000

const KIND_META: Record<
  Notification['kind'],
  { icon: typeof Inbox; tone: string; chime: Chime; label: string }
> = {
  assigned: { icon: Sparkles, tone: 'var(--c-accent)', chime: 'arrive', label: 'New work' },
  submitted: { icon: Inbox, tone: 'var(--c-cyan)', chime: 'arrive', label: 'Handed in' },
  approved: { icon: CheckCircle2, tone: 'var(--c-accent)', chime: 'good', label: 'Approved' },
  declined: { icon: X, tone: 'var(--c-rose)', chime: 'warn', label: 'Sent back' },
  comment: { icon: MessageSquare, tone: 'var(--c-violet)', chime: 'arrive', label: 'Message' },
  due: { icon: Clock, tone: 'var(--c-amber)', chime: 'warn', label: 'Deadline' },
  mention: { icon: MessageSquare, tone: 'var(--c-violet)', chime: 'arrive', label: 'Mention' },
}

export function NotificationCenter() {
  const { state, me, prefs, markRead } = useApp()
  const { openTask, go } = useUI()

  const [queue, setQueue] = useState<Notification[]>([])
  /** Ids already pushed through the live channels, so nothing announces twice. */
  const delivered = useRef<Set<string> | null>(null)
  const timers = useRef(new Map<string, number>())

  const mine = me ? state.notifications.filter((n) => n.userId === me.id) : []
  const unread = mine.filter((n) => !n.read).length

  const dismiss = useCallback((id: string) => {
    setQueue((q) => q.filter((x) => x.id !== id))
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const push = useCallback(
    (items: Notification[]) => {
      setQueue((q) => [...q, ...items].slice(-3))
      for (const n of items) {
        if (timers.current.has(n.id)) continue
        timers.current.set(n.id, window.setTimeout(() => dismiss(n.id), TTL))
      }
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      for (const t of map.values()) window.clearTimeout(t)
      map.clear()
    }
  }, [])

  // Unread count in the tab title — a backgrounded tab still says so.
  useEffect(() => {
    const base = 'Flow · Media System'
    document.title = unread > 0 ? `(${unread}) ${base}` : base
  }, [unread])

  // Switching account must re-seed the baseline, or the next person's whole
  // history arrives at once as "new".
  const baselineFor = useRef<string | null>(null)

  useEffect(() => {
    if (!me) {
      delivered.current = null
      baselineFor.current = null
      return
    }
    if (baselineFor.current !== me.id) {
      baselineFor.current = me.id
      delivered.current = null
      setQueue([])
    }
    // The first pass for an account seeds the baseline: history is not news.
    if (delivered.current === null) {
      delivered.current = new Set(mine.map((n) => n.id))
      return
    }

    const fresh = mine.filter((n) => !n.read && !delivered.current!.has(n.id))
    if (!fresh.length) return
    for (const n of fresh) delivered.current.add(n.id)

    if (prefs.soundAlerts) playChime(KIND_META[fresh[0].kind]?.chime ?? 'arrive')

    // Only reach past the page when the person is not looking at it.
    if (prefs.desktopAlerts && document.visibilityState === 'hidden') {
      if (fresh.length === 1) showDesktop(fresh[0].title, fresh[0].body, fresh[0].id)
      else showDesktop(`${fresh.length} updates in Flow`, fresh.map((n) => n.title).join(' · '), 'flow-batch')
    }

    if (prefs.liveAlerts) push(fresh)
    // `mine` is derived each render; the delivered set is what guards repeats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, state.notifications, prefs.soundAlerts, prefs.desktopAlerts, prefs.liveAlerts, push])

  if (!me) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-20 z-90 flex w-[336px] max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {queue.map((n) => {
          const meta = KIND_META[n.kind] ?? KIND_META.assigned
          const Icon = meta.icon
          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 44, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="pointer-events-auto group relative overflow-hidden rounded-xl border bg-panel shadow-lift"
              style={{ borderColor: `color-mix(in oklab, ${meta.tone} 40%, transparent)` }}
            >
              <button
                onClick={() => {
                  markRead(n.id)
                  if (n.taskId) openTask(n.taskId)
                  else if (n.initiativeId) go('initiatives')
                  dismiss(n.id)
                }}
                className="flex w-full items-start gap-3 p-3.5 pr-9 text-left"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  style={{ background: `color-mix(in oklab, ${meta.tone} 16%, transparent)`, color: meta.tone }}
                >
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-medium uppercase tracking-wider" style={{ color: meta.tone }}>
                    {meta.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] font-medium">{n.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed text-fg-faint">{n.body}</span>
                </span>
              </button>

              <button
                aria-label="Dismiss"
                onClick={() => {
                  markRead(n.id)
                  dismiss(n.id)
                }}
                className="absolute right-2.5 top-2.5 text-fg-faint opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X size={14} />
              </button>

              {/* The card visibly expires rather than just vanishing. */}
              <motion.span
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left"
                style={{ background: meta.tone }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: TTL / 1000, ease: 'linear' }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export { KIND_META }
