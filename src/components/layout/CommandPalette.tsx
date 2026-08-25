import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Bot, CornerDownLeft, Hash, Search, User as UserIcon } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI, type ViewId } from '@/store/ui'
import { can, visibleTasks } from '@/lib/permissions'
import { ROLES } from '@/lib/permissions'
import { fmtDate } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import { Kbd } from '@/components/ui/primitives'
import { cn } from '@/components/ui/cn'

interface Row {
  id: string
  kind: 'view' | 'task' | 'member' | 'ask'
  label: string
  sub?: string
  icon: React.ReactNode
  run: () => void
}

/** ⌘K launcher: jump to a view, a task, a person, or hand the query to the assistant. */
export function CommandPalette() {
  const { me, state } = useApp()
  const { paletteOpen, setPaletteOpen, go, openTask, openMember, askAssistant } = useUI()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPaletteOpen])

  useEffect(() => {
    if (paletteOpen) {
      setQ('')
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [paletteOpen])

  const rows = useMemo<Row[]>(() => {
    if (!me) return []
    const close = () => setPaletteOpen(false)
    const term = q.trim().toLowerCase()

    const allViews: { id: ViewId; label: string }[] = [
      { id: 'dashboard', label: 'Overview' },
      { id: 'board', label: 'Work' },
      { id: 'scoreboard', label: 'Scoreboard' },
      { id: 'initiatives', label: 'Initiatives' },
      { id: 'team', label: 'Team' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'assistant', label: 'Assistant' },
      { id: 'settings', label: 'Settings' },
    ]
    const views = allViews.filter((v) => v.id !== 'analytics' || can(me, 'analytics.view'))

    const viewRows: Row[] = views
      .filter((v) => !term || v.label.toLowerCase().includes(term))
      .map((v) => ({
        id: `view-${v.id}`,
        kind: 'view',
        label: v.label,
        sub: 'Go to',
        icon: <ArrowRight size={14} />,
        run: () => {
          go(v.id)
          close()
        },
      }))

    const taskRows: Row[] = visibleTasks(me, state.tasks)
      .filter((t) => !term || `${t.code} ${t.title} ${t.tags.join(' ')}`.toLowerCase().includes(term))
      .slice(0, term ? 8 : 4)
      .map((t) => ({
        id: `task-${t.id}`,
        kind: 'task',
        label: t.title,
        sub: `${t.code} · ${state.users.find((u) => u.id === t.assigneeId)?.name ?? '—'} · due ${fmtDate(t.dueAt)}`,
        icon: <Hash size={14} />,
        run: () => {
          openTask(t.id)
          close()
        },
      }))

    const memberRows: Row[] = state.users
      .filter((u) => u.active && (!term || `${u.name} ${u.role} ${u.title}`.toLowerCase().includes(term)))
      .slice(0, term ? 6 : 0)
      .map((u) => ({
        id: `member-${u.id}`,
        kind: 'member',
        label: u.name,
        sub: `${ROLES[u.role].label} · ${u.title}`,
        icon: <Avatar user={u} size="xs" />,
        run: () => {
          openMember(u.id)
          go('team')
          close()
        },
      }))

    const askRow: Row[] = term
      ? [
          {
            id: 'ask',
            kind: 'ask',
            label: `Ask the assistant: "${q.trim()}"`,
            sub: 'Answers from live workspace data',
            icon: <Bot size={14} />,
            run: () => {
              askAssistant(q.trim())
              close()
            },
          },
        ]
      : []

    return [...taskRows, ...memberRows, ...viewRows, ...askRow]
  }, [me, q, state.tasks, state.users, go, openTask, openMember, askAssistant, setPaletteOpen])

  useEffect(() => setCursor(0), [q])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(rows.length - 1, c + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(0, c - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      rows[cursor]?.run()
    } else if (e.key === 'Escape') {
      setPaletteOpen(false)
    }
  }

  return (
    <AnimatePresence>
      {paletteOpen && (
        <div className="fixed inset-0 z-150 flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-bg-deep/70 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setPaletteOpen(false)}
          />
          <motion.div
            className="panel relative w-full max-w-xl overflow-hidden p-0 shadow-lift"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={16} className="shrink-0 text-fg-faint" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search tasks, people, or ask a question…"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-faint"
              />
              <Kbd>esc</Kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {rows.length === 0 && <p className="px-3 py-10 text-center text-[13px] text-fg-faint">No matches.</p>}
              {rows.map((r, i) => (
                <button
                  key={r.id}
                  onMouseEnter={() => setCursor(i)}
                  onClick={r.run}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    i === cursor ? 'bg-panel-3' : 'hover:bg-panel-2',
                  )}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-panel-2 text-fg-faint">
                    {r.kind === 'member' ? r.icon : r.kind === 'view' ? <ArrowRight size={13} /> : r.kind === 'ask' ? <Bot size={13} /> : <Hash size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{r.label}</span>
                    {r.sub && <span className="block truncate text-[11px] text-fg-faint">{r.sub}</span>}
                  </span>
                  {i === cursor && <CornerDownLeft size={13} className="shrink-0 text-fg-faint" />}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-fg-faint">
              <span className="inline-flex items-center gap-1.5"><Kbd>↑↓</Kbd> navigate</span>
              <span className="inline-flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
              <span className="ml-auto inline-flex items-center gap-1.5"><UserIcon size={11} /> {state.users.filter((u) => u.active).length} members</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
