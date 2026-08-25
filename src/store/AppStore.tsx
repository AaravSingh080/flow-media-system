import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { buildSeedState } from '@/lib/seed'
import { hydrateDemoMedia } from '@/lib/demoMedia'
import { clearAll, digest, loadSession, loadState, saveState } from '@/lib/storage'
import { deleteBlob } from '@/lib/media'
import { uid, pad } from '@/lib/id'
import { DAY } from '@/lib/format'
import type {
  ActivityEntry,
  ActivityType,
  AppState,
  Attachment,
  Initiative,
  Notification,
  Preferences,
  Priority,
  Role,
  Task,
  TaskStatus,
  User,
} from '@/types'

const DEFAULT_PREFS: Preferences = {
  theme: 'dark',
  lastView: 'dashboard',
  reduceMotion: false,
  density: 'comfortable',
  boardMode: 'board',
}

export interface NewTaskInput {
  title: string
  brief: string
  assigneeId: string
  points: number
  priority: Priority
  startAt: number
  dueAt: number
  tags: string[]
  attachments: Attachment[]
  watchers?: string[]
}

interface Store {
  state: AppState
  me: User | null
  prefs: Preferences
  ready: boolean

  signIn(email: string, password: string, remember: boolean): { ok: boolean; error?: string }
  signUp(input: { name: string; email: string; password: string; role: Role; title: string }): { ok: boolean; error?: string }
  signOut(): void
  switchTo(userId: string): void

  createTask(input: NewTaskInput): Task
  patchTask(id: string, patch: Partial<Task>, log?: { type: ActivityType; message: string }): void
  setStatus(id: string, status: TaskStatus): void
  submitTask(id: string, note: string, deliverables: Attachment[]): void
  approveTask(id: string, opts: { points: number; rating: number; note: string }): void
  reopenTask(id: string, reason: string): void
  reassignTask(id: string, assigneeId: string): void
  commentOnTask(id: string, body: string, attachments: Attachment[]): void
  deleteTask(id: string): void

  createInitiative(input: { title: string; description: string; attachments: Attachment[]; effortHours?: number }): void
  decideInitiative(id: string, decision: 'approved' | 'declined', points: number, note: string): void

  updateUser(id: string, patch: Partial<User>): void
  addUser(input: { name: string; email: string; password: string; role: Role; title: string; bio?: string; skills?: string[] }): { ok: boolean; error?: string }

  markRead(id: string): void
  markAllRead(): void

  setPrefs(patch: Partial<Preferences>): void
  exportData(): void
  importData(json: string): { ok: boolean; error?: string }
  resetWorkspace(): void
}

const Ctx = createContext<Store | null>(null)

/** Boot state: saved workspace if present, otherwise the seeded demo. */
function bootState(): { state: AppState; fresh: boolean } {
  const saved = loadState()
  if (saved) return { state: { ...saved, session: loadSession() }, fresh: false }
  return { state: { ...buildSeedState(), session: null }, fresh: true }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const boot = useRef(bootState())
  const [state, setState] = useState<AppState>(boot.current.state)
  const [ready, setReady] = useState(!boot.current.fresh)

  // First boot generates the demo voice notes and reference frames. It is
  // async (canvas + IndexedDB), so the shell waits on it once and never again.
  useEffect(() => {
    if (!boot.current.fresh) return
    let cancelled = false
    void (async () => {
      try {
        const tasks = await hydrateDemoMedia(boot.current.state.tasks)
        if (!cancelled) setState((s) => ({ ...s, tasks }))
      } catch (err) {
        console.warn('[flow] demo media generation skipped', err)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    saveState(state)
  }, [state])

  const me = useMemo(
    () => (state.session ? state.users.find((u) => u.id === state.session!.userId) ?? null : null),
    [state.session, state.users],
  )

  const prefs = useMemo<Preferences>(
    () => ({ ...DEFAULT_PREFS, ...(me ? state.prefs[me.id] : undefined) }),
    [me, state.prefs],
  )

  /* ------------------------------ helpers ------------------------------ */

  const notify = useCallback((state: AppState, items: Omit<Notification, 'id' | 'at' | 'read'>[]): Notification[] => {
    const fresh = items
      // Never notify someone about their own action.
      .filter((n) => !!n.userId)
      .map<Notification>((n) => ({ ...n, id: uid('n'), at: Date.now(), read: false }))
    return [...fresh, ...state.notifications].slice(0, 200)
  }, [])

  const logEntry = (type: ActivityType, actorId: string, message: string): ActivityEntry => ({
    id: uid('act'),
    type,
    actorId,
    at: Date.now(),
    message,
  })

  /* -------------------------------- auth ------------------------------- */

  const signIn = useCallback<Store['signIn']>(
    (email, password, remember) => {
      const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      if (!user) return { ok: false, error: 'No account with that email.' }
      if (!user.active) return { ok: false, error: 'That account has been deactivated.' }
      if (user.secret !== digest(password)) return { ok: false, error: 'That password does not match.' }
      setState((s) => ({ ...s, session: { userId: user.id, since: Date.now(), remember } }))
      return { ok: true }
    },
    [state.users],
  )

  const signUp = useCallback<Store['signUp']>(
    ({ name, email, password, role, title }) => {
      const clean = email.trim().toLowerCase()
      if (state.users.some((u) => u.email.toLowerCase() === clean)) {
        return { ok: false, error: 'That email is already registered.' }
      }
      if (password.length < 6) return { ok: false, error: 'Use at least 6 characters.' }
      const accents = ['var(--c-cyan)', 'var(--c-violet)', 'var(--c-amber)', 'var(--c-rose)', 'var(--c-emerald)', 'var(--c-slate)']
      const user: User = {
        id: uid('u'),
        name: name.trim(),
        email: clean,
        secret: digest(password),
        role,
        title: title.trim() || 'Team member',
        bio: '',
        skills: [],
        accent: accents[state.users.length % accents.length],
        joinedAt: Date.now(),
        active: true,
      }
      setState((s) => ({ ...s, users: [...s.users, user], session: { userId: user.id, since: Date.now(), remember: true } }))
      return { ok: true }
    },
    [state.users],
  )

  const signOut = useCallback(() => setState((s) => ({ ...s, session: null })), [])

  const switchTo = useCallback((userId: string) => {
    setState((s) => ({ ...s, session: { userId, since: Date.now(), remember: s.session?.remember ?? true } }))
  }, [])

  /* -------------------------------- tasks ------------------------------ */

  const createTask = useCallback<Store['createTask']>(
    (input) => {
      const actor = me
      if (!actor) throw new Error('not signed in')
      const now = Date.now()
      const seq = state.counters.task + 1
      const task: Task = {
        id: uid('t'),
        code: `FLW-${pad(seq)}`,
        title: input.title.trim(),
        brief: input.brief,
        attachments: input.attachments,
        createdBy: actor.id,
        assigneeId: input.assigneeId,
        watchers: input.watchers ?? [],
        status: 'backlog',
        priority: input.priority,
        points: input.points,
        startAt: input.startAt,
        dueAt: input.dueAt,
        createdAt: now,
        updatedAt: now,
        tags: input.tags,
        deliverables: [],
        completionNote: '',
        comments: [],
        activity: [
          logEntry('created', actor.id, 'opened the brief'),
          logEntry('assigned', actor.id, `assigned this to ${state.users.find((u) => u.id === input.assigneeId)?.name ?? 'a member'}`),
          logEntry('points', actor.id, `set the value at ${input.points} points`),
        ],
      }
      setState((s) => ({
        ...s,
        tasks: [task, ...s.tasks],
        counters: { ...s.counters, task: seq },
        notifications:
          input.assigneeId === actor.id
            ? s.notifications
            : notify(s, [
                {
                  userId: input.assigneeId,
                  kind: 'assigned',
                  title: `${actor.name} assigned you ${task.code}`,
                  body: task.title,
                  taskId: task.id,
                },
              ]),
      }))
      return task
    },
    [me, notify, state.counters.task, state.users],
  )

  const patchTask = useCallback<Store['patchTask']>(
    (id, patch, log) => {
      const actorId = me?.id ?? 'system'
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                updatedAt: Date.now(),
                activity: log ? [...t.activity, logEntry(log.type, actorId, log.message)] : t.activity,
              }
            : t,
        ),
      }))
    },
    [me],
  )

  const setStatus = useCallback<Store['setStatus']>(
    (id, status) => {
      const label = { backlog: 'Backlog', in_progress: 'In progress', in_review: 'In review', done: 'Done' }[status]
      patchTask(id, { status }, { type: 'status', message: `moved this to ${label}` })
    },
    [patchTask],
  )

  const submitTask = useCallback<Store['submitTask']>(
    (id, note, deliverables) => {
      const actor = me
      if (!actor) return
      const now = Date.now()
      setState((s) => {
        const task = s.tasks.find((t) => t.id === id)
        if (!task) return s
        const admins = s.users.filter((u) => u.active && u.role === 'admin' && u.id !== actor.id)
        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'in_review',
                  submittedAt: now,
                  updatedAt: now,
                  completionNote: note,
                  deliverables: [...t.deliverables, ...deliverables],
                  activity: [
                    ...t.activity,
                    logEntry(
                      'submitted',
                      actor.id,
                      deliverables.length
                        ? `submitted ${deliverables.length} file${deliverables.length === 1 ? '' : 's'} for review`
                        : 'marked this done and left a write-up',
                    ),
                  ],
                }
              : t,
          ),
          notifications: notify(s, admins.map((a) => ({
            userId: a.id,
            kind: 'submitted' as const,
            title: `${actor.name} submitted ${task.code}`,
            body: task.title,
            taskId: task.id,
          }))),
        }
      })
    },
    [me, notify],
  )

  const approveTask = useCallback<Store['approveTask']>(
    (id, { points, rating, note }) => {
      const actor = me
      if (!actor) return
      const now = Date.now()
      setState((s) => {
        const task = s.tasks.find((t) => t.id === id)
        if (!task) return s
        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'done',
                  points,
                  pointsAwarded: points,
                  approvedAt: now,
                  approvedBy: actor.id,
                  reviewNote: note,
                  reviewRating: rating,
                  updatedAt: now,
                  activity: [...t.activity, logEntry('approved', actor.id, `approved this and released ${points} points`)],
                }
              : t,
          ),
          notifications: notify(s, [
            {
              userId: task.assigneeId,
              kind: 'approved',
              title: `${task.code} approved — ${points} points`,
              body: note || 'Signed off by ' + actor.name,
              taskId: task.id,
            },
          ]),
        }
      })
    },
    [me, notify],
  )

  const reopenTask = useCallback<Store['reopenTask']>(
    (id, reason) => {
      const actor = me
      if (!actor) return
      setState((s) => {
        const task = s.tasks.find((t) => t.id === id)
        if (!task) return s
        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'in_progress',
                  submittedAt: undefined,
                  approvedAt: undefined,
                  approvedBy: undefined,
                  pointsAwarded: undefined,
                  updatedAt: Date.now(),
                  activity: [...t.activity, logEntry('reopened', actor.id, `sent this back: ${reason || 'needs another pass'}`)],
                }
              : t,
          ),
          notifications: notify(s, [
            {
              userId: task.assigneeId,
              kind: 'declined',
              title: `${task.code} sent back for changes`,
              body: reason || 'Needs another pass.',
              taskId: task.id,
            },
          ]),
        }
      })
    },
    [me, notify],
  )

  const reassignTask = useCallback<Store['reassignTask']>(
    (id, assigneeId) => {
      const actor = me
      if (!actor) return
      setState((s) => {
        const task = s.tasks.find((t) => t.id === id)
        const target = s.users.find((u) => u.id === assigneeId)
        if (!task || !target) return s
        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  assigneeId,
                  updatedAt: Date.now(),
                  activity: [...t.activity, logEntry('assigned', actor.id, `reassigned this to ${target.name}`)],
                }
              : t,
          ),
          notifications:
            assigneeId === actor.id
              ? s.notifications
              : notify(s, [
                  { userId: assigneeId, kind: 'assigned', title: `${actor.name} assigned you ${task.code}`, body: task.title, taskId: task.id },
                ]),
        }
      })
    },
    [me, notify],
  )

  const commentOnTask = useCallback<Store['commentOnTask']>(
    (id, body, attachments) => {
      const actor = me
      if (!actor) return
      setState((s) => {
        const task = s.tasks.find((t) => t.id === id)
        if (!task) return s
        const audience = new Set([task.assigneeId, task.createdBy, ...task.watchers])
        audience.delete(actor.id)
        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  updatedAt: Date.now(),
                  comments: [...t.comments, { id: uid('c'), authorId: actor.id, body, attachments, createdAt: Date.now() }],
                  activity: [...t.activity, logEntry('commented', actor.id, 'left a comment')],
                }
              : t,
          ),
          notifications: notify(s, [...audience].map((userId) => ({
            userId,
            kind: 'comment' as const,
            title: `${actor.name} commented on ${task.code}`,
            body: body.slice(0, 90) || 'Sent an attachment',
            taskId: task.id,
          }))),
        }
      })
    },
    [me, notify],
  )

  const deleteTask = useCallback<Store['deleteTask']>((id) => {
    setState((s) => {
      const task = s.tasks.find((t) => t.id === id)
      // Reclaim the IndexedDB space the brief and deliverables were using.
      if (task) {
        for (const att of [...task.attachments, ...task.deliverables, ...task.comments.flatMap((c) => c.attachments)]) {
          void deleteBlob(att.blobId)
        }
      }
      return { ...s, tasks: s.tasks.filter((t) => t.id !== id) }
    })
  }, [])

  /* ----------------------------- initiatives --------------------------- */

  const createInitiative = useCallback<Store['createInitiative']>(
    ({ title, description, attachments, effortHours }) => {
      const actor = me
      if (!actor) return
      const seq = state.counters.initiative + 1
      const item: Initiative = {
        id: uid('i'),
        code: `IN-${pad(seq)}`,
        title: title.trim(),
        description,
        attachments,
        proposedBy: actor.id,
        createdAt: Date.now(),
        status: 'pending',
        effortHours,
      }
      setState((s) => ({
        ...s,
        initiatives: [item, ...s.initiatives],
        counters: { ...s.counters, initiative: seq },
        notifications: notify(s, s.users
          .filter((u) => u.active && u.role === 'admin' && u.id !== actor.id)
          .map((a) => ({
            userId: a.id,
            kind: 'submitted' as const,
            title: `${actor.name} logged self-directed work`,
            body: item.title,
            initiativeId: item.id,
          }))),
      }))
    },
    [me, notify, state.counters.initiative],
  )

  const decideInitiative = useCallback<Store['decideInitiative']>(
    (id, decision, points, note) => {
      const actor = me
      if (!actor) return
      setState((s) => {
        const item = s.initiatives.find((i) => i.id === id)
        if (!item) return s
        return {
          ...s,
          initiatives: s.initiatives.map((i) =>
            i.id === id
              ? { ...i, status: decision, points: decision === 'approved' ? points : 0, decidedBy: actor.id, decidedAt: Date.now(), decisionNote: note }
              : i,
          ),
          notifications: notify(s, [
            {
              userId: item.proposedBy,
              kind: decision === 'approved' ? 'approved' : 'declined',
              title:
                decision === 'approved'
                  ? `${item.code} scored at ${points} points`
                  : `${item.code} was not scored`,
              body: note || item.title,
              initiativeId: item.id,
            },
          ]),
        }
      })
    },
    [me, notify],
  )

  /* -------------------------------- people ----------------------------- */

  const updateUser = useCallback<Store['updateUser']>((id, patch) => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
  }, [])

  const addUser = useCallback<Store['addUser']>(
    ({ name, email, password, role, title, bio, skills }) => {
      const clean = email.trim().toLowerCase()
      if (state.users.some((u) => u.email.toLowerCase() === clean)) return { ok: false, error: 'That email already exists.' }
      const accents = ['var(--c-cyan)', 'var(--c-violet)', 'var(--c-amber)', 'var(--c-rose)', 'var(--c-emerald)', 'var(--c-slate)']
      setState((s) => ({
        ...s,
        users: [
          ...s.users,
          {
            id: uid('u'),
            name: name.trim(),
            email: clean,
            secret: digest(password),
            role,
            title: title.trim() || 'Team member',
            bio: bio ?? '',
            skills: skills ?? [],
            accent: accents[s.users.length % accents.length],
            joinedAt: Date.now(),
            active: true,
          },
        ],
      }))
      return { ok: true }
    },
    [state.users],
  )

  /* --------------------------- notifications --------------------------- */

  const markRead = useCallback((id: string) => {
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }))
  }, [])

  const markAllRead = useCallback(() => {
    const uid = me?.id
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => (n.userId === uid ? { ...n, read: true } : n)) }))
  }, [me])

  /* ------------------------------- prefs ------------------------------- */

  const setPrefs = useCallback<Store['setPrefs']>(
    (patch) => {
      const id = me?.id
      if (!id) return
      setState((s) => ({ ...s, prefs: { ...s.prefs, [id]: { ...DEFAULT_PREFS, ...s.prefs[id], ...patch } } }))
    },
    [me],
  )

  /* ------------------------------ workspace ---------------------------- */

  const exportData = useCallback(() => {
    // Media stays in IndexedDB; this is the structured record only.
    const blob = new Blob([JSON.stringify({ ...state, session: null }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flow-workspace-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }, [state])

  const importData = useCallback<Store['importData']>((json) => {
    try {
      const parsed = JSON.parse(json) as AppState
      if (!Array.isArray(parsed.users) || !Array.isArray(parsed.tasks)) {
        return { ok: false, error: 'That file is not a Flow workspace export.' }
      }
      setState({ ...parsed, session: null })
      return { ok: true }
    } catch {
      return { ok: false, error: 'That file could not be parsed as JSON.' }
    }
  }, [])

  const resetWorkspace = useCallback(() => {
    clearAll()
    window.location.reload()
  }, [])

  /* ----------------------- deadline notifications ---------------------- */

  // One nudge per task per session when it crosses into the last 24 hours.
  const warned = useRef(new Set<string>())
  useEffect(() => {
    if (!me) return
    const tick = () => {
      const now = Date.now()
      const due = state.tasks.filter(
        (t) => t.assigneeId === me.id && t.status !== 'done' && t.dueAt - now < DAY && t.dueAt > now && !warned.current.has(t.id),
      )
      if (!due.length) return
      for (const t of due) warned.current.add(t.id)
      setState((s) => ({
        ...s,
        notifications: notify(s, due.map((t) => ({
          userId: me.id,
          kind: 'due' as const,
          title: `${t.code} is due within 24 hours`,
          body: t.title,
          taskId: t.id,
        }))),
      }))
    }
    tick()
    const timer = window.setInterval(tick, 120_000)
    return () => window.clearInterval(timer)
  }, [me, notify, state.tasks])

  const value = useMemo<Store>(
    () => ({
      state, me, prefs, ready,
      signIn, signUp, signOut, switchTo,
      createTask, patchTask, setStatus, submitTask, approveTask, reopenTask, reassignTask, commentOnTask, deleteTask,
      createInitiative, decideInitiative,
      updateUser, addUser,
      markRead, markAllRead,
      setPrefs, exportData, importData, resetWorkspace,
    }),
    [
      state, me, prefs, ready,
      signIn, signUp, signOut, switchTo,
      createTask, patchTask, setStatus, submitTask, approveTask, reopenTask, reassignTask, commentOnTask, deleteTask,
      createInitiative, decideInitiative,
      updateUser, addUser,
      markRead, markAllRead,
      setPrefs, exportData, importData, resetWorkspace,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/** Convenience: the signed-in user, asserted. Only call inside the shell. */
export function useMe(): User {
  const { me } = useApp()
  if (!me) throw new Error('useMe called with no session')
  return me
}

export function useUser(id: string): User | undefined {
  const { state } = useApp()
  return state.users.find((u) => u.id === id)
}
