import { motion } from 'motion/react'
import { BarChart3, Bot, LayoutDashboard, Sparkles, Trophy, Users } from 'lucide-react'
import { useUI, type ViewId } from '@/store/ui'
import { cn } from '@/components/ui/cn'

const ITEMS: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'board', label: 'Work', icon: Sparkles },
  { id: 'scoreboard', label: 'Points', icon: Trophy },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'assistant', label: 'Ask', icon: Bot },
]

export function MobileNav() {
  const { view, go } = useUI()
  return (
    <nav className="flex h-16 shrink-0 items-stretch border-t border-line bg-panel/90 backdrop-blur-xl md:hidden">
      {ITEMS.map((item) => {
        const active = view === item.id
        return (
          <button
            key={item.id}
            onClick={() => go(item.id)}
            className={cn('relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors', active ? 'text-fg' : 'text-fg-faint')}
          >
            {active && <motion.span layoutId="mobile-tick" className="absolute top-0 h-[2px] w-8 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <item.icon size={17} className={active ? 'text-accent-fg' : ''} />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

export { BarChart3 }
