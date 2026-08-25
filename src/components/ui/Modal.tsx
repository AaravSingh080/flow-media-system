import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from './cn'
import { Button } from './primitives'

function useLockScroll(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-2xl',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useLockScroll(open)
  useEscape(open, onClose)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            className="absolute inset-0 bg-bg-deep/72 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn('panel relative flex max-h-[88vh] w-full flex-col overflow-hidden shadow-lift', width)}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {(title || subtitle) && (
              <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-[17px] font-semibold">{title}</h2>
                  {subtitle && <p className="mt-0.5 text-[13px] text-fg-faint">{subtitle}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                  <X size={16} />
                </Button>
              </header>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Right-hand sheet. Used for task detail so the board stays visible. */
export function Drawer({
  open,
  onClose,
  children,
  width = 'sm:w-[560px]',
  label,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: string
  label?: string
}) {
  useLockScroll(open)
  useEscape(open, onClose)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-100">
          <motion.div
            className="absolute inset-0 bg-bg-deep/62 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            aria-label={label}
            className={cn(
              'absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-panel shadow-lift',
              width,
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
          >
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
