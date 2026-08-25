import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, Check, LogOut, Moon, Plus, Search, Sun } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { ROLES, can } from '@/lib/permissions'
import { relTime } from '@/lib/format'
import { Avatar, RoleTag } from '@/components/ui/Avatar'
import { Button, Kbd } from '@/components/ui/primitives'
import { cn } from '@/components/ui/cn'
import { Wordmark } from './Sidebar'
import { KIND_META } from './NotificationCenter'

const TITLES: Record<string, { title: string; sub: string }> = {
  dashboard: { title: 'Overview', sub: 'Where the studio stands today' },
  board: { title: 'Work', sub: 'Every brief, who holds it, and when it lands' },
  scoreboard: { title: 'Scoreboard', sub: 'Contribution measured in released points' },
  initiatives: { title: 'Initiatives', sub: 'Work nobody assigned, brought forward for scoring' },
  team: { title: 'Team', sub: 'Roles, access and how each person works' },
  analytics: { title: 'Analytics', sub: 'Throughput, punctuality and where effort goes' },
  assistant: { title: 'Assistant', sub: 'Ask about the work, the deadlines or the people' },
  settings: { title: 'Settings', sub: 'Your account, this device, and the workspace record' },
}

export function Topbar() {
  const { me, state, prefs, setPrefs, signOut, markAllRead, markRead } = useApp()
  const { view, setComposeOpen, setPaletteOpen, openTask, go, openMember } = useUI()
  const [bellOpen, setBellOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  if (!me) return null
  const meta = TITLES[view] ?? TITLES.dashboard
  const mine = state.notifications.filter((n) => n.userId === me.id)
  const unread = mine.filter((n) => !n.read).length

  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="md:hidden">
        <Wordmark compact />
      </div>

      <div className="hidden min-w-0 flex-1 md:block">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="truncate text-[15px] font-semibold leading-tight">{meta.title}</h1>
            <p className="truncate text-[12px] text-fg-faint">{meta.sub}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden h-9 items-center gap-2 rounded-xl border border-line bg-panel-2 pl-3 pr-2 text-[13px] text-fg-faint transition-colors hover:border-line-strong hover:text-fg-muted lg:flex"
        >
          <Search size={14} />
          <span className="pr-6">Search or jump…</span>
          <Kbd>⌘K</Kbd>
        </button>

        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
          <Search size={16} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}
          aria-label={prefs.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={prefs.theme}
              initial={{ opacity: 0, rotate: -60, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 60, scale: 0.7 }}
              transition={{ duration: 0.2 }}
              className="grid place-items-center"
            >
              {prefs.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </motion.span>
          </AnimatePresence>
        </Button>

        <div className="relative" ref={bellRef}>
          <Button variant="ghost" size="icon" onClick={() => setBellOpen((v) => !v)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Bell size={16} />
            {unread > 0 && (
              <>
                <span className="absolute right-1.5 top-1.5 h-4 min-w-4 animate-ping rounded-full bg-rose/40" />
                {/* text-bg, not white: the dark-theme rose is light enough that
                    white on it only reaches 2.7:1. */}
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[9px] font-bold text-bg">
                  {unread > 9 ? '9+' : unread}
                </span>
              </>
            )}
          </Button>

          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="panel absolute right-0 top-[calc(100%+8px)] w-[340px] overflow-hidden p-0 shadow-lift"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="text-[13px] font-semibold">Notifications</p>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="inline-flex items-center gap-1 text-[11px] text-fg-faint hover:text-fg">
                      <Check size={11} /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[380px] overflow-y-auto">
                  {mine.length === 0 && (
                    <p className="px-4 py-10 text-center text-[13px] text-fg-faint">
                      Nothing yet. New work, hand-ins and sign-offs land here.
                    </p>
                  )}
                  {/* Unread first — the queue is a to-do list, not a diary. */}
                  {[...mine]
                    .sort((a, b) => Number(a.read) - Number(b.read) || b.at - a.at)
                    .slice(0, 20)
                    .map((n) => {
                      const meta = KIND_META[n.kind] ?? KIND_META.assigned
                      const Icon = meta.icon
                      return (
                        <button
                          key={n.id}
                          onClick={() => {
                            markRead(n.id)
                            if (n.taskId) openTask(n.taskId)
                            else if (n.initiativeId) go('initiatives')
                            setBellOpen(false)
                          }}
                          className={cn(
                            'flex w-full gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-panel-2',
                            !n.read && 'bg-accent/4',
                          )}
                        >
                          <span
                            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                            style={{
                              background: `color-mix(in oklab, ${meta.tone} 14%, transparent)`,
                              color: meta.tone,
                            }}
                          >
                            <Icon size={13} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] font-medium">{n.title}</span>
                              {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-fg-faint">{n.body}</span>
                            <span className="mt-1 block text-[10px] text-fg-faint">
                              {meta.label} · {relTime(n.at)}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {can(me, 'task.create') && (
          <Button variant="primary" size="sm" onClick={() => setComposeOpen(true)} className="ml-1">
            <Plus size={15} />
            <span className="hidden sm:inline">New brief</span>
          </Button>
        )}

        <div className="relative ml-1" ref={menuRef}>
          <button onClick={() => setMenuOpen((v) => !v)} className="block rounded-full transition-transform hover:scale-105" aria-label="Account menu">
            <Avatar user={me} size="sm" ring />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="panel absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden p-0 shadow-lift"
              >
                <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
                  <Avatar user={me} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{me.name}</p>
                    <p className="truncate text-[11px] text-fg-faint">{me.email}</p>
                    <div className="mt-1">
                      <RoleTag role={me.role} />
                      <span className="ml-1.5 text-[10px] text-fg-faint">{ROLES[me.role].label}</span>
                    </div>
                  </div>
                </div>
                <div className="p-1.5">
                  <MenuItem
                    onClick={() => {
                      openMember(me.id)
                      go('team')
                      setMenuOpen(false)
                    }}
                  >
                    Your profile
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      go('settings')
                      setMenuOpen(false)
                    }}
                  >
                    Settings
                  </MenuItem>
                  <MenuItem onClick={signOut} danger>
                    <LogOut size={13} /> Sign out
                  </MenuItem>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
        danger ? 'text-rose hover:bg-rose/10' : 'text-fg-muted hover:bg-panel-2 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}
