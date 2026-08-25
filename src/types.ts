/* ------------------------------------------------------------------ *
 * Flow — domain model
 * Everything the app knows about lives in these shapes. The store is
 * persisted to localStorage; binary media lives in IndexedDB and is
 * referenced from here by `blobId`.
 * ------------------------------------------------------------------ */

export type Role =
  | 'admin'
  | 'editor'
  | 'designer'
  | 'videographer'
  | 'writer'
  | 'social'
  | 'member'
  | 'client'

export type TaskStatus = 'backlog' | 'in_progress' | 'in_review' | 'done'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type AttachmentKind = 'image' | 'video' | 'audio' | 'file'

export interface Attachment {
  id: string
  kind: AttachmentKind
  name: string
  mime: string
  size: number
  /** Key into the IndexedDB blob store. */
  blobId: string
  /** Data-URL poster for videos, generated on upload. */
  poster?: string
  /** Normalised 0..1 amplitude peaks, for voice notes. */
  peaks?: number[]
  durationMs?: number
  uploadedBy: string
  createdAt: number
}

export type ActivityType =
  | 'created'
  | 'assigned'
  | 'status'
  | 'commented'
  | 'submitted'
  | 'approved'
  | 'reopened'
  | 'points'
  | 'due'

export interface ActivityEntry {
  id: string
  type: ActivityType
  actorId: string
  at: number
  /** Human-readable summary, pre-rendered at write time. */
  message: string
}

export interface Comment {
  id: string
  authorId: string
  body: string
  attachments: Attachment[]
  createdAt: number
}

export interface Task {
  id: string
  code: string
  title: string
  /** The written half of the brief. May be empty if the brief is voice-only. */
  brief: string
  /** Voice notes, reference images, footage — the media half of the brief. */
  attachments: Attachment[]

  createdBy: string
  assigneeId: string
  watchers: string[]

  status: TaskStatus
  priority: Priority
  /** Points the assigner attached to this task. Light work = low, heavy = high. */
  points: number
  /** Locked in when an admin approves. Undefined until then. */
  pointsAwarded?: number

  startAt: number
  dueAt: number
  createdAt: number
  updatedAt: number
  submittedAt?: number
  approvedAt?: number
  approvedBy?: string

  tags: string[]

  /** What the assignee handed back. */
  deliverables: Attachment[]
  /** The assignee's own write-up on completion. */
  completionNote: string
  /** The reviewer's verdict. */
  reviewNote?: string
  reviewRating?: number

  comments: Comment[]
  activity: ActivityEntry[]
  archived?: boolean
}

export type InitiativeStatus = 'pending' | 'approved' | 'declined'

/** Work a member did off their own bat, submitted for scoring. */
export interface Initiative {
  id: string
  code: string
  title: string
  description: string
  attachments: Attachment[]
  proposedBy: string
  createdAt: number
  status: InitiativeStatus
  points?: number
  decidedBy?: string
  decidedAt?: number
  decisionNote?: string
  effortHours?: number
}

export interface User {
  id: string
  name: string
  email: string
  /** Demo-grade digest. See lib/auth.ts — this is not real security. */
  secret: string
  role: Role
  title: string
  bio: string
  skills: string[]
  accent: string
  joinedAt: number
  active: boolean
  avatar?: string
}

export interface Notification {
  id: string
  userId: string
  kind: 'assigned' | 'submitted' | 'approved' | 'declined' | 'comment' | 'due' | 'mention'
  title: string
  body: string
  taskId?: string
  initiativeId?: string
  at: number
  read: boolean
}

export interface Session {
  userId: string
  since: number
  remember: boolean
}

export interface Preferences {
  theme: 'dark' | 'light'
  lastView: string
  reduceMotion: boolean
  density: 'comfortable' | 'compact'
  boardMode: 'board' | 'list' | 'timeline'
}

export interface AppState {
  version: number
  users: User[]
  tasks: Task[]
  initiatives: Initiative[]
  notifications: Notification[]
  session: Session | null
  prefs: Record<string, Preferences>
  counters: { task: number; initiative: number }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  /** Structured payload the assistant renders as cards rather than prose. */
  cards?: AssistantCard[]
  suggestions?: string[]
  pending?: boolean
}

export type AssistantCard =
  | { type: 'tasks'; ids: string[]; label: string }
  | { type: 'members'; ids: string[]; label: string }
  | { type: 'scoreboard'; rows: { userId: string; value: number; sub?: string }[]; label: string; unit: string }
  | { type: 'ethic'; userId: string }
  | { type: 'stat'; items: { label: string; value: string; tone?: string }[] }
