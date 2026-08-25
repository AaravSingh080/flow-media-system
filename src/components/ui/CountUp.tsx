import { useEffect, useRef, useState } from 'react'
import { cn } from './cn'

/**
 * Animates to a target number. Keeps the digit count stable while running
 * so headline stats don't reflow the layout mid-count.
 */
export function CountUp({
  value,
  duration = 750,
  className,
  decimals = 0,
  suffix = '',
}: {
  value: number
  duration?: number
  className?: string
  decimals?: number
  suffix?: string
}) {
  const [display, setDisplay] = useState(value)
  const from = useRef(value)
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    const start = performance.now()
    const origin = from.current
    const delta = value - origin
    if (delta === 0) return

    const reduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.motion === 'reduced'
    if (reduced) {
      from.current = value
      setDisplay(value)
      return
    }

    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      // easeOutExpo — fast off the line, settles gently.
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      setDisplay(origin + delta * eased)
      if (p < 1) frame.current = requestAnimationFrame(step)
      else from.current = value
    }
    frame.current = requestAnimationFrame(step)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      from.current = value
    }
  }, [value, duration])

  return (
    <span className={cn('num tabular-nums', className)}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  )
}
