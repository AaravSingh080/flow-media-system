import { ROLES } from '@/lib/permissions'
import { initials } from '@/lib/format'
import type { User } from '@/types'
import { cn } from './cn'

const SIZES = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-2xl',
} as const

export function Avatar({
  user,
  size = 'md',
  ring,
  className,
}: {
  user: Pick<User, 'name' | 'accent' | 'role'> | undefined
  size?: keyof typeof SIZES
  ring?: boolean
  className?: string
}) {
  if (!user) {
    return <div className={cn('rounded-full bg-panel-3', SIZES[size], className)} />
  }
  return (
    <div
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full font-semibold tracking-wide select-none',
        SIZES[size],
        ring && 'ring-2 ring-offset-2 ring-offset-bg',
        className,
      )}
      style={{
        background: `color-mix(in oklab, ${user.accent} 22%, transparent)`,
        color: user.accent,
        // `ring-color` needs a real value; Tailwind's ring utilities can't
        // reach a per-user CSS variable.
        ...(ring ? ({ ['--tw-ring-color' as string]: user.accent }) : {}),
      }}
      title={user.name}
    >
      {initials(user.name)}
    </div>
  )
}

export function RoleTag({ role, className }: { role: User['role']; className?: string }) {
  const meta = ROLES[role]
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider', className)}
      style={{ background: `color-mix(in oklab, ${meta.accent} 16%, transparent)`, color: meta.accent }}
      title={meta.label}
    >
      {meta.short}
    </span>
  )
}

/** Overlapping avatar row, used for watchers and team strips. */
export function AvatarStack({ users, max = 4, size = 'sm' }: { users: User[]; max?: number; size?: keyof typeof SIZES }) {
  const shown = users.slice(0, max)
  const rest = users.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((u, i) => (
        <div key={u.id} className="rounded-full ring-2 ring-panel" style={{ marginLeft: i === 0 ? 0 : -8, zIndex: max - i }}>
          <Avatar user={u} size={size} />
        </div>
      ))}
      {rest > 0 && (
        <div
          className="grid h-8 w-8 place-items-center rounded-full bg-panel-3 text-[10px] font-semibold text-fg-faint ring-2 ring-panel"
          style={{ marginLeft: -8 }}
        >
          +{rest}
        </div>
      )}
    </div>
  )
}
