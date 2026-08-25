import { DAY, startOfDay } from './format'
import type { AppState, Initiative, Task, User } from '@/types'

/* ------------------------------------------------------------------ *
 * Derived stats
 *
 * Nothing here is stored — every number is recomputed from tasks and
 * initiatives so the scoreboard can never drift from the record.
 * ------------------------------------------------------------------ */

export interface MemberStats {
  userId: string
  /** Approved task points + approved initiative points. */
  points: number
  taskPoints: number
  initiativePoints: number
  completed: number
  approved: number
  active: number
  overdue: number
  onTime: number
  late: number
  /** 0..1 — share of approved work delivered before the deadline. */
  onTimeRate: number
  /** Mean ms from start to hand-in. */
  avgTurnaround: number
  /** Mean of `(due - submitted) / (due - start)`; >0 means habitually early. */
  earlyIndex: number
  avgRating: number
  ratedCount: number
  /** Consecutive most-recent approved tasks delivered on time. */
  streak: number
  initiativesApproved: number
  initiativesPending: number
  /** Composite 0..100. See `reliabilityScore`. */
  reliability: number
  lastActiveAt: number
  workload: number
}

function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function clamp(n: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Blends four signals into one headline number:
 *   punctuality 40% · sign-off quality 25% · throughput 20% · initiative 15%
 * Someone with no completed work sits at 0 rather than a misleading 100.
 */
export function reliabilityScore(s: Omit<MemberStats, 'reliability'>): number {
  if (s.approved === 0 && s.initiativesApproved === 0) return 0
  const punctuality = s.approved ? s.onTimeRate : 0.5
  const quality = s.ratedCount ? s.avgRating / 5 : 0.6
  const throughput = clamp(s.approved / 12)
  const drive = clamp(s.initiativesApproved / 4)
  const raw = punctuality * 0.4 + quality * 0.25 + throughput * 0.2 + drive * 0.15
  // A live overdue task is a present-tense problem, so it bites the score.
  const penalty = clamp(s.overdue * 0.06, 0, 0.3)
  return Math.round(clamp(raw - penalty) * 100)
}

export function statsFor(userId: string, tasks: Task[], initiatives: Initiative[], now = Date.now()): MemberStats {
  const mine = tasks.filter((t) => t.assigneeId === userId && !t.archived)
  const approved = mine.filter((t) => t.status === 'done' && t.approvedAt)
  const submitted = mine.filter((t) => t.submittedAt)
  const active = mine.filter((t) => t.status === 'backlog' || t.status === 'in_progress')
  const overdue = mine.filter((t) => t.status !== 'done' && t.dueAt < now)

  const onTimeFlags = approved.map((t) => (t.submittedAt ?? t.approvedAt ?? now) <= t.dueAt)
  const onTime = onTimeFlags.filter(Boolean).length
  const late = onTimeFlags.length - onTime

  const turnarounds = submitted
    .map((t) => (t.submittedAt ?? 0) - t.startAt)
    .filter((ms) => ms > 0)

  const earlyRatios = approved
    .map((t) => {
      const window = t.dueAt - t.startAt
      if (window <= 0) return 0
      return ((t.dueAt - (t.submittedAt ?? t.approvedAt ?? now)) / window)
    })
    .filter((n) => Number.isFinite(n))

  const ratings = approved.map((t) => t.reviewRating).filter((r): r is number => typeof r === 'number')

  // Streak walks backwards through the most recently approved work.
  const chronological = [...approved].sort((a, b) => (b.approvedAt ?? 0) - (a.approvedAt ?? 0))
  let streak = 0
  for (const t of chronological) {
    if ((t.submittedAt ?? t.approvedAt ?? now) <= t.dueAt) streak++
    else break
  }

  const myInitiatives = initiatives.filter((i) => i.proposedBy === userId)
  const approvedInitiatives = myInitiatives.filter((i) => i.status === 'approved')

  const taskPoints = approved.reduce((sum, t) => sum + (t.pointsAwarded ?? t.points), 0)
  const initiativePoints = approvedInitiatives.reduce((sum, i) => sum + (i.points ?? 0), 0)

  // Scheduled work carries a future `updatedAt`; activity is a past-tense fact.
  const lastActiveAt = Math.min(
    now,
    Math.max(0, ...mine.map((t) => t.updatedAt), ...myInitiatives.map((i) => i.createdAt)),
  )

  const base = {
    userId,
    points: taskPoints + initiativePoints,
    taskPoints,
    initiativePoints,
    completed: approved.length + submitted.filter((t) => t.status === 'in_review').length,
    approved: approved.length,
    active: active.length,
    overdue: overdue.length,
    onTime,
    late,
    onTimeRate: onTimeFlags.length ? onTime / onTimeFlags.length : 0,
    avgTurnaround: mean(turnarounds),
    earlyIndex: mean(earlyRatios),
    avgRating: mean(ratings),
    ratedCount: ratings.length,
    streak,
    initiativesApproved: approvedInitiatives.length,
    initiativesPending: myInitiatives.filter((i) => i.status === 'pending').length,
    lastActiveAt,
    // Open work weighted by size — a proxy for "how buried are they".
    workload: active.reduce((sum, t) => sum + Math.max(1, t.points) / 10, 0),
  }

  return { ...base, reliability: reliabilityScore(base) }
}

export function leaderboard(state: AppState, now = Date.now()): MemberStats[] {
  return state.users
    .filter((u) => u.active && u.role !== 'client')
    .map((u) => statsFor(u.id, state.tasks, state.initiatives, now))
    .sort((a, b) => b.points - a.points || b.approved - a.approved)
}

/* ------------------------------------------------------------------ *
 * Levels — a light progression ladder over lifetime points.
 * ------------------------------------------------------------------ */

export interface Level {
  index: number
  name: string
  min: number
  next: number | null
}

const TIERS: { name: string; min: number }[] = [
  { name: 'Runner', min: 0 },
  { name: 'Operator', min: 50 },
  { name: 'Specialist', min: 120 },
  { name: 'Lead', min: 220 },
  { name: 'Principal', min: 360 },
  { name: 'Luminary', min: 550 },
]

export function levelFor(points: number): Level {
  let idx = 0
  for (let i = 0; i < TIERS.length; i++) if (points >= TIERS[i].min) idx = i
  return {
    index: idx,
    name: TIERS[idx].name,
    min: TIERS[idx].min,
    next: idx < TIERS.length - 1 ? TIERS[idx + 1].min : null,
  }
}

/* ------------------------------------------------------------------ *
 * Time series
 * ------------------------------------------------------------------ */

export interface DayPoint {
  ts: number
  completed: number
  points: number
  opened: number
}

export function dailySeries(tasks: Task[], days = 30, now = Date.now()): DayPoint[] {
  const today = startOfDay(now)
  const out: DayPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push({ ts: today - i * DAY, completed: 0, points: 0, opened: 0 })
  }
  const index = new Map(out.map((d, i) => [d.ts, i]))
  for (const t of tasks) {
    if (t.approvedAt) {
      const slot = index.get(startOfDay(t.approvedAt))
      if (slot !== undefined) {
        out[slot].completed++
        out[slot].points += t.pointsAwarded ?? t.points
      }
    }
    const openSlot = index.get(startOfDay(t.createdAt))
    if (openSlot !== undefined) out[openSlot].opened++
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Workspace-wide rollups
 * ------------------------------------------------------------------ */

export interface Pulse {
  open: number
  inReview: number
  overdue: number
  dueToday: number
  dueThisWeek: number
  completedThisWeek: number
  pointsThisWeek: number
  pendingInitiatives: number
  unassignedPoints: number
  throughput: number
}

export function pulse(state: AppState, now = Date.now()): Pulse {
  const live = state.tasks.filter((t) => !t.archived)
  const weekAgo = now - 7 * DAY
  const endOfToday = startOfDay(now) + DAY
  const endOfWeek = startOfDay(now) + 7 * DAY

  const completedThisWeek = live.filter((t) => (t.approvedAt ?? 0) >= weekAgo)
  const open = live.filter((t) => t.status !== 'done')

  return {
    open: open.length,
    inReview: live.filter((t) => t.status === 'in_review').length,
    overdue: open.filter((t) => t.dueAt < now).length,
    dueToday: open.filter((t) => t.dueAt >= now && t.dueAt < endOfToday).length,
    dueThisWeek: open.filter((t) => t.dueAt >= now && t.dueAt < endOfWeek).length,
    completedThisWeek: completedThisWeek.length,
    pointsThisWeek: completedThisWeek.reduce((s, t) => s + (t.pointsAwarded ?? t.points), 0),
    pendingInitiatives: state.initiatives.filter((i) => i.status === 'pending').length,
    unassignedPoints: open.reduce((s, t) => s + t.points, 0),
    throughput: completedThisWeek.length / 7,
  }
}

/** Points broken out by tag — what the team actually spends effort on. */
export function pointsByTag(tasks: Task[]): { tag: string; points: number; count: number }[] {
  const map = new Map<string, { points: number; count: number }>()
  for (const t of tasks) {
    if (!t.approvedAt) continue
    const pts = t.pointsAwarded ?? t.points
    for (const tag of t.tags.length ? t.tags : ['untagged']) {
      const cur = map.get(tag) ?? { points: 0, count: 0 }
      cur.points += pts
      cur.count++
      map.set(tag, cur)
    }
  }
  return [...map.entries()]
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((a, b) => b.points - a.points)
}

/** Plain-language read on a member's habits, used by the assistant. */
export function ethicSummary(user: User, s: MemberStats): string {
  if (!s.approved && !s.initiativesApproved) {
    return `${user.name} has no signed-off work on the board yet, so there is nothing to read into their habits.`
  }
  const pct = Math.round(s.onTimeRate * 100)
  const punctual =
    pct >= 90 ? 'delivers on time almost without exception'
    : pct >= 70 ? 'is dependable on deadlines with the occasional slip'
    : pct >= 45 ? 'hits about half their deadlines'
    : 'struggles to land work by the agreed date'

  const pace =
    s.earlyIndex > 0.25 ? 'and typically hands in with time to spare'
    : s.earlyIndex > 0.02 ? 'and usually finishes just ahead of the buzzer'
    : 'and tends to run right up to the deadline'

  const quality = s.ratedCount
    ? ` Sign-off ratings average ${s.avgRating.toFixed(1)} out of 5 across ${s.ratedCount} reviewed ${s.ratedCount === 1 ? 'delivery' : 'deliveries'}.`
    : ' No deliveries have been rated yet.'

  const drive = s.initiativesApproved
    ? ` They have also brought ${s.initiativesApproved} ${s.initiativesApproved === 1 ? 'piece' : 'pieces'} of self-directed work to the table.`
    : ''

  const flag = s.overdue ? ` Right now ${s.overdue} of their open ${s.overdue === 1 ? 'task is' : 'tasks are'} past due.` : ''
  const streak = s.streak >= 3 ? ` Current on-time streak: ${s.streak}.` : ''

  return `${user.name} ${punctual} ${pace} (${pct}% on time over ${s.approved} approved ${s.approved === 1 ? 'task' : 'tasks'}).${quality}${drive}${streak}${flag}`
}
