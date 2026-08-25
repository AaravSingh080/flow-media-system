import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { uid } from '@/lib/id'
import { cn } from './cn'

type Tone = 'success' | 'error' | 'info'

interface Toast {
  id: string
  tone: Tone
  title: string
  body?: string
}

const Ctx = createContext<{ toast: (t: Omit<Toast, 'id'>) => void } | null>(null)

const ICONS: Record<Tone, ReactNode> = {
  success: <CheckCircle2 size={16} />,
  error: <AlertTriangle size={16} />,
  info: <Info size={16} />,
}

const TONES: Record<Tone, string> = {
  success: 'text-accent-fg',
  error: 'text-rose',
  info: 'text-cyan',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const timers = useRef(new Map<string, number>())

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = uid('toast')
      setItems((list) => [...list.slice(-3), { ...t, id }])
      timers.current.set(id, window.setTimeout(() => dismiss(id), t.tone === 'error' ? 6000 : 4000))
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-200 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-panel px-4 py-3 shadow-lift"
            >
              <span className={cn('mt-0.5 shrink-0', TONES[t.tone])}>{ICONS[t.tone]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-5">{t.title}</p>
                {t.body && <p className="mt-0.5 text-xs leading-relaxed text-fg-faint">{t.body}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="mt-0.5 text-fg-faint transition-colors hover:text-fg">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.toast
}
