import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from './cn'

/* ------------------------------- Button ------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent hover:brightness-110 active:brightness-95 shadow-[0_1px_0_rgba(255,255,255,0.25)_inset]',
  secondary: 'bg-panel-3 text-fg hover:bg-line-strong',
  ghost: 'text-fg-muted hover:text-fg hover:bg-panel-3',
  outline: 'hairline text-fg hover:bg-panel-3 hover:border-line-strong',
  danger: 'bg-rose/15 text-rose hover:bg-rose/25',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center font-medium select-none whitespace-nowrap',
        'transition-[background-color,color,border-color,filter,transform] duration-150',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      )}
      <span className={cn('inline-flex items-center gap-[inherit]', loading && 'opacity-0')}>{children}</span>
    </button>
  )
})

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4 animate-spin', className)} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* -------------------------------- Panel ------------------------------- */

export function Panel({
  className,
  children,
  padded = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div className={cn('panel', padded && 'p-5', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({
  children,
  action,
  hint,
}: {
  children: ReactNode
  action?: ReactNode
  hint?: string
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
        {hint && <p className="mt-0.5 text-xs text-fg-faint">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/* -------------------------------- Badge ------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'violet' | 'cyan' | 'amber' | 'rose' | 'emerald'
  className?: string
  dot?: boolean
}) {
  const tones: Record<string, string> = {
    neutral: 'text-fg-muted bg-panel-3',
    accent: 'text-accent-fg bg-accent-soft',
    violet: 'text-violet bg-violet/12',
    cyan: 'text-cyan bg-cyan/12',
    amber: 'text-amber bg-amber/14',
    rose: 'text-rose bg-rose/14',
    emerald: 'text-emerald bg-emerald/12',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ------------------------------- Segmented ---------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  layoutId,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  size?: 'sm' | 'md'
  layoutId?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-xl bg-panel-3 p-1', size === 'sm' && 'rounded-lg')}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative rounded-lg px-3 font-medium transition-colors',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
              active ? 'text-fg' : 'text-fg-faint hover:text-fg-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId ?? 'segmented'}
                className="absolute inset-0 rounded-lg bg-panel shadow-soft"
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------- Progress ----------------------------- */

export function Progress({
  value,
  className,
  tone = 'var(--c-accent)',
  height = 6,
}: {
  value: number
  className?: string
  tone?: string
  height?: number
}) {
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-panel-3', className)} style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: tone }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 24 }}
      />
    </div>
  )
}

/* ------------------------------ EmptyState ---------------------------- */

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-panel-3 text-fg-faint">{icon}</div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-fg-faint">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------- Skeleton ----------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg bg-panel-3', className)} />
}

/* -------------------------------- Tooltip ----------------------------- */

export function Tooltip({ label, children, side = 'top' }: { label: string; children: ReactNode; side?: 'top' | 'bottom' }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-[11px] font-medium text-bg opacity-0 shadow-lift transition-opacity duration-150 group-hover/tip:opacity-100',
          side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
        )}
      >
        {label}
      </span>
    </span>
  )
}

/* --------------------------------- Kbd -------------------------------- */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="hairline rounded-md bg-panel-3 px-1.5 py-0.5 font-mono text-[10px] leading-4 text-fg-faint">
      {children}
    </kbd>
  )
}
