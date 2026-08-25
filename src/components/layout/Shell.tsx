import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNav } from './MobileNav'
import { CommandPalette } from './CommandPalette'
import { NotificationCenter } from './NotificationCenter'
import { Dashboard } from '@/views/Dashboard'
import { Board } from '@/views/Board'
import { Scoreboard } from '@/views/Scoreboard'
import { Initiatives } from '@/views/Initiatives'
import { Team } from '@/views/Team'
import { Analytics } from '@/views/Analytics'
import { Assistant } from '@/views/Assistant'
import { SettingsView } from '@/views/Settings'
import { TaskDrawer } from '@/views/TaskDrawer'
import { ComposeTask } from '@/views/ComposeTask'

const VIEWS = {
  dashboard: Dashboard,
  board: Board,
  scoreboard: Scoreboard,
  initiatives: Initiatives,
  team: Team,
  analytics: Analytics,
  assistant: Assistant,
  settings: SettingsView,
} as const

export function Shell() {
  const { prefs } = useApp()
  const { view } = useUI()

  // Theme and motion preference live on <html> so the CSS token blocks and
  // the reduced-motion override apply to portalled overlays too. `color-scheme`
  // rides along in the token blocks, which also themes browser-drawn controls.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.theme === 'dark')
  }, [prefs.theme])

  useEffect(() => {
    document.documentElement.dataset.motion = prefs.reduceMotion ? 'reduced' : 'full'
  }, [prefs.reduceMotion])

  const View = VIEWS[view] ?? Dashboard

  return (
    <div className="grain flex h-dvh w-full overflow-hidden bg-bg">
      <Sidebar />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              <View />
            </motion.div>
          </AnimatePresence>
        </main>

        <MobileNav />
      </div>

      <TaskDrawer />
      <ComposeTask />
      <CommandPalette />
      <NotificationCenter />
    </div>
  )
}
