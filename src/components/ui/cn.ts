import clsx, { type ClassValue } from 'clsx'

/** Tailwind-friendly class joiner. Order wins on conflicts, as usual. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
