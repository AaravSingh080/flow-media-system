import { motion } from 'motion/react'
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  Lightbulb,
  Settings,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI, type ViewId } from '@/store/ui'
import { ROLES, can, type Capability } from '@/lib/permissions'
import { pulse } from '@/lib/analytics'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/components/ui/cn'

interface NavItem {
  id: ViewId
  label: string
  icon: typeof LayoutDashboard
  cap?: Capability
  badge?: (counts: { review: number; initiatives: number; overdue: number }) => number
}

const NAV: NavItem[][] = [
  [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'board', label: 'Work', icon: Sparkles, badge: (c) => c.overdue },
  ],
  [
    { id: 'scoreboard', label: 'Scoreboard', icon: Trophy },
    { id: 'initiatives', label: 'Initiatives', icon: Lightbulb, badge: (c) => c.initiatives },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, cap: 'analytics.view' },
  ],
  [
    { id: 'assistant', label: 'Assistant', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings },
  ],
]

export function Sidebar() {
  const { me, state } = useApp()
  const { view, go, openMember } = useUI()
  if (!me) return null

  const p = pulse(state)
  const counts = {
    review: p.inReview,
    initiatives: can(me, 'initiative.decide') ? p.pendingInitiatives : 0,
    overdue: state.tasks.filter((t) => t.status !== 'done' && t.dueAt < Date.now() && (can(me, 'task.viewAll') || t.assigneeId === me.id)).length,
  }

  return (
    <aside className="hidden w-[228px] shrink-0 flex-col border-r border-line bg-panel-2/60 md:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Wordmark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV.map((group, gi) => {
          const items = group.filter((i) => !i.cap || can(me, i.cap))
          if (!items.length) return null
          return (
            <div key={gi} className={cn(gi > 0 && 'mt-5 border-t border-line pt-5')}>
              {items.map((item) => {
                const active = view === item.id
                const badge = item.badge?.(counts) ?? 0
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors duration-150',
                      active ? 'text-fg' : 'text-fg-muted hover:text-fg',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-xl bg-panel shadow-soft"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    {/* The accent tick reads as "you are here" even at a glance. */}
                    {active && (
                      <motion.span
                        layoutId="nav-tick"
                        className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    <item.icon
                      size={16}
                      className={cn('relative z-10 shrink-0 transition-colors', active ? 'text-accent-fg' : 'text-fg-faint group-hover:text-fg-muted')}
                    />
                    <span className="relative z-10 flex-1 truncate">{item.label}</span>
                    {badge > 0 && (
                      <span className="num relative z-10 rounded-full bg-rose/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose">
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      <button
        onClick={() => {
          openMember(me.id)
          go('team')
        }}
        className="m-3 flex items-center gap-3 rounded-xl border border-line bg-panel p-2.5 text-left transition-colors hover:border-line-strong"
      >
        <Avatar user={me} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{me.name}</span>
          <span className="block truncate text-[11px] text-fg-faint">{ROLES[me.role].label}</span>
        </span>
      </button>
    </aside>
  )
}

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-fg text-bg">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path d="M6 18V6h12v3.2h-8.4v2.6H17v3.2H9.6V18z" fill="currentColor" />
        </svg>
        <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-panel-2" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-semibold tracking-tight">Flow</span>
          <span className="block text-[10px] uppercase tracking-[0.14em] text-fg-faint">Media System</span>
        </span>
      )}
    </span>
  )
}
