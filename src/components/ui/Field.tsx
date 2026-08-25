import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from './cn'

const CONTROL =
  'w-full rounded-xl border border-line bg-panel-2 px-3.5 text-sm text-fg placeholder:text-fg-faint ' +
  'transition-[border-color,background-color,box-shadow] duration-150 ' +
  'hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/12 ' +
  'disabled:opacity-50'

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-medium text-fg-muted">{children}</span>
      {hint && <span className="text-[11px] text-fg-faint">{hint}</span>}
    </label>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leading?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, className, ...rest },
  ref,
) {
  const id = useId()
  return (
    <div className="w-full">
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faint">{leading}</span>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(CONTROL, 'h-11', leading && 'pl-10', error && 'border-rose focus:border-rose focus:ring-rose/12', className)}
          {...rest}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-rose">{error}</p>}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, rows = 4, ...rest },
  ref,
) {
  const id = useId()
  return (
    <div className="w-full">
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        className={cn(CONTROL, 'resize-y py-3 leading-relaxed', error && 'border-rose', className)}
        {...rest}
      />
      {error && <p className="mt-1.5 text-xs text-rose">{error}</p>}
    </div>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, className, children, ...rest },
  ref,
) {
  const id = useId()
  return (
    <div className="w-full">
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <div className="relative">
        <select
          id={id}
          ref={ref}
          className={cn(CONTROL, 'h-11 appearance-none pr-10', className)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-faint" />
      </div>
    </div>
  )
})

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl p-1 text-left transition-colors hover:bg-panel-2"
    >
      <span
        className={cn(
          'mt-0.5 relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-panel shadow-sm transition-transform duration-200',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
          style={{ background: checked ? 'var(--c-on-accent)' : 'var(--c-panel)' }}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-fg-faint">{description}</span>}
      </span>
    </button>
  )
}

/**
 * Point picker. Points are the spine of the whole scoring system, so this
 * gives the bands names as well as numbers rather than leaving people to
 * guess what "35" means.
 */
export function PointsField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const bands = [
    { label: 'Light', range: [5, 20], hint: 'an hour or two' },
    { label: 'Standard', range: [21, 40], hint: 'most of a day' },
    { label: 'Heavy', range: [41, 60], hint: 'multiple days' },
    { label: 'Major', range: [61, 120], hint: 'a project in itself' },
  ]
  const band = bands.find((b) => value >= b.range[0] && value <= b.range[1]) ?? bands[bands.length - 1]

  return (
    <div className="w-full">
      <Label hint={`${band.label} · ${band.hint}`}>Point value</Label>
      <div className="rounded-xl border border-line bg-panel-2 p-3.5">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-panel-3 accent-[var(--c-accent)]"
            style={{
              background: `linear-gradient(to right, var(--c-accent) ${((value - 5) / 115) * 100}%, var(--c-panel-3) ${((value - 5) / 115) * 100}%)`,
            }}
          />
          <input
            type="number"
            min={0}
            max={999}
            value={value}
            onChange={(e) => onChange(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
            className="num h-9 w-20 rounded-lg border border-line bg-panel px-2 text-center text-sm font-semibold focus:border-accent focus:outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {bands.map((b) => {
            const active = b.label === band.label
            return (
              <button
                key={b.label}
                type="button"
                onClick={() => onChange(Math.round((b.range[0] + b.range[1]) / 2 / 5) * 5)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  active ? 'bg-accent text-on-accent' : 'bg-panel-3 text-fg-faint hover:text-fg-muted',
                )}
              >
                {active && <Check size={11} />}
                {b.label}
                <span className="num opacity-60">{b.range[0]}–{b.range[1]}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TagInput({ value, onChange, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[] }) {
  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-')
    if (tag && !value.includes(tag)) onChange([...value, tag])
  }
  const remaining = suggestions.filter((s) => !value.includes(s)).slice(0, 6)

  return (
    <div className="w-full">
      <Label hint="Enter to add">Tags</Label>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-panel-2 px-2.5 py-2 focus-within:border-accent">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-panel-3 px-2 py-1 text-[11px] font-medium">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-fg-faint hover:text-rose">
              ×
            </button>
          </span>
        ))}
        <input
          className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-fg-faint"
          placeholder={value.length ? '' : 'northbeam, edit, social…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(e.currentTarget.value)
              e.currentTarget.value = ''
            } else if (e.key === 'Backspace' && !e.currentTarget.value && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-faint transition-colors hover:border-line-strong hover:text-fg-muted"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
