import type { Role, Task, User } from '@/types'

/* ------------------------------------------------------------------ *
 * Roles & capabilities
 *
 * Every gated action in the UI resolves through `can()`. Adding a role
 * means adding a row to ROLE_CAPS — nothing else in the app hard-codes
 * a role name to decide what a person may do.
 * ------------------------------------------------------------------ */

export const CAPABILITIES = [
  'task.create',        // open a brief at all
  'task.assign.any',    // hand it to anyone, including another admin
  'task.setPoints',     // attach a point value
  'task.approve',       // sign off completed work and release points
  'task.editAny',       // edit a brief you did not write
  'task.deleteAny',
  'task.viewAll',       // see the whole board, not just your lane
  'initiative.create',  // log self-directed work for scoring
  'initiative.decide',  // score somebody else's self-directed work
  'team.viewAll',       // browse member profiles
  'team.manage',        // invite, deactivate, change roles
  'analytics.view',
  'settings.manage',
] as const

export type Capability = (typeof CAPABILITIES)[number]

const ALL = [...CAPABILITIES] as Capability[]

const CONTRIBUTOR: Capability[] = [
  'task.viewAll',
  'initiative.create',
  'team.viewAll',
]

/** A lead can brief and shape work, but cannot set points or sign off. */
const LEAD: Capability[] = [
  ...CONTRIBUTOR,
  'task.create',
  'task.assign.any',
  'task.editAny',
  'analytics.view',
]

export const ROLE_CAPS: Record<Role, Capability[]> = {
  admin: ALL,
  editor: LEAD,
  designer: CONTRIBUTOR,
  videographer: CONTRIBUTOR,
  writer: CONTRIBUTOR,
  social: [...CONTRIBUTOR, 'analytics.view'],
  member: CONTRIBUTOR,
  client: ['team.viewAll'],
}

export interface RoleMeta {
  id: Role
  label: string
  short: string
  accent: string
  blurb: string
}

export const ROLES: Record<Role, RoleMeta> = {
  admin: {
    id: 'admin',
    label: 'Admin',
    short: 'ADM',
    accent: 'var(--c-accent)',
    blurb: 'Briefs work, sets point values, signs off deliverables, runs the team.',
  },
  editor: {
    id: 'editor',
    label: 'Editor',
    short: 'EDT',
    accent: 'var(--c-cyan)',
    blurb: 'Cuts and finishes video. Can brief work, but points stay with admins.',
  },
  designer: {
    id: 'designer',
    label: 'Graphic Designer',
    short: 'DSG',
    accent: 'var(--c-violet)',
    blurb: 'Key art, thumbnails, layouts, brand systems.',
  },
  videographer: {
    id: 'videographer',
    label: 'Videographer',
    short: 'VID',
    accent: 'var(--c-amber)',
    blurb: 'Shoots and lights. Owns raw capture and on-set delivery.',
  },
  writer: {
    id: 'writer',
    label: 'Writer',
    short: 'WRT',
    accent: 'var(--c-rose)',
    blurb: 'Scripts, copy, captions, narrative structure.',
  },
  social: {
    id: 'social',
    label: 'Social Manager',
    short: 'SOC',
    accent: 'var(--c-emerald)',
    blurb: 'Scheduling, community, channel performance.',
  },
  member: {
    id: 'member',
    label: 'Member',
    short: 'MBR',
    accent: 'var(--c-slate)',
    blurb: 'General contributor. Picks up assigned work across disciplines.',
  },
  client: {
    id: 'client',
    label: 'Client',
    short: 'CLT',
    accent: 'var(--c-fg-faint)',
    blurb: 'Read-only guest. Sees only the work they are watching.',
  },
}

export const ROLE_LIST = Object.values(ROLES)

export function can(user: User | null | undefined, cap: Capability): boolean {
  if (!user || !user.active) return false
  return ROLE_CAPS[user.role]?.includes(cap) ?? false
}

/** Capability check that also accepts ownership as a reason to allow. */
export function canEditTask(user: User | null, task: Task): boolean {
  if (!user) return false
  if (can(user, 'task.editAny')) return true
  return task.createdBy === user.id
}

/** Only the assignee hands work in. Admins can hand in on someone's behalf. */
export function canSubmitTask(user: User | null, task: Task): boolean {
  if (!user) return false
  if (task.status === 'done') return false
  return task.assigneeId === user.id || can(user, 'task.approve')
}

/**
 * You cannot approve — and therefore cannot release points to — your own
 * submission. That rule holds even for admins; another admin signs off.
 */
export function canApproveTask(user: User | null, task: Task): boolean {
  if (!user || !can(user, 'task.approve')) return false
  if (task.status !== 'in_review') return false
  return task.assigneeId !== user.id
}

export function canDecideInitiative(user: User | null, proposedBy: string): boolean {
  if (!user || !can(user, 'initiative.decide')) return false
  return proposedBy !== user.id
}

/** The set of tasks a person is allowed to lay eyes on. */
export function visibleTasks(user: User | null, tasks: Task[]): Task[] {
  if (!user) return []
  if (can(user, 'task.viewAll')) return tasks
  return tasks.filter(
    (t) => t.assigneeId === user.id || t.createdBy === user.id || t.watchers.includes(user.id),
  )
}

export function roleAccent(role: Role): string {
  return ROLES[role]?.accent ?? 'var(--c-slate)'
}
