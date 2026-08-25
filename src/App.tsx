import { AnimatePresence, motion } from 'motion/react'
import { AppProvider, useApp } from '@/store/AppStore'
import { UIProvider } from '@/store/ui'
import { ToastProvider } from '@/components/ui/Toast'
import { Shell } from '@/components/layout/Shell'
import { Login } from '@/views/Login'
import { Wordmark } from '@/components/layout/Sidebar'

function Gate() {
  const { me, ready } = useApp()

  if (!ready) return <Boot />

  return (
    <AnimatePresence mode="wait">
      {me ? (
        <motion.div
          key="shell"
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="h-dvh"
        >
          <UIProvider>
            <Shell />
          </UIProvider>
        </motion.div>
      ) : (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <Login />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Shown once, on the very first load, while the demo media is generated. */
function Boot() {
  return (
    <div className="grain grid h-dvh place-items-center bg-bg">
      <div className="relative z-10 flex flex-col items-center gap-5">
        <Wordmark />
        <div className="flex items-end gap-1" aria-label="Preparing workspace">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              className="w-1 rounded-full bg-accent"
              animate={{ height: [8, 22, 8] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <p className="text-[12px] text-fg-faint">Preparing your workspace…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AppProvider>
  )
}
