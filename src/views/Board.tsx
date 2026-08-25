import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarRange, Filter, KanbanSquare, List, Plus, Search, X } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { can, canEditTask, visibleTasks } from '@/lib/permissions'
import { DAY, fmtDate, startOfDay } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import { Button, EmptyState, Segmented } from '@/components/ui/primitives'
import { Input, Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/components/ui/cn'
import { DueChip, PriorityMark, STATUS_META, StatusPill, TaskCard } from '@/components/task/TaskBits'
import type { Task, TaskStatus } from '@/types'

const COLUMNS: TaskStatus[] = ['backlog', 'in_progress', 'in_review', 'done']

export function Board() {
  const { state, me, prefs, setPrefs, setStatus } = useApp()
  const { openTask, setComposeOpen } = useUI()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [assignee, setAssignee] = useState('all')
  const [tag, setTag] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)

  const mode = prefs.boardMode

  const allTags = useMemo(() => [...new Set(state.tasks.flatMap((t) => t.tags))].sort(), [state.tasks])

  const tasks = useMemo(() => {
    if (!me) return []
    let list = visibleTasks(me, state.tasks).filter((t) => !t.archived)
    const term = q.trim().toLowerCase()
    if (term) list = list.filter((t) => `${t.code} ${t.title} ${t.brief} ${t.tags.join(' ')}`.toLowerCase().includes(term))
    if (assignee !== 'all') list = list.filter((t) => t.assigneeId === assignee)
    if (tag !== 'all') list = list.filter((t) => t.tags.includes(tag))
    return list
  }, [me, state.tasks, q, assignee, tag])

  if (!me) return null
  const filtersOn = assignee !== 'all' || tag !== 'all' || !!q.trim()

  const drop = (status: TaskStatus) => {
    setDropTarget(null)
    if (!dragging) return
    const task = state.tasks.find((t) => t.id === dragging)
    setDragging(null)
    if (!task || task.status === status) return

    // Signing off is a deliberate act with a point value attached, so the
    // board never lets someone drag a card straight into Done.
    if (status === 'done') {
      toast({
        tone: 'info',
        title: 'Open the task to sign it off',
        body: 'Approving releases points and needs a review note, so it happens in the task itself.',
      })
      return
    }
    if (status === 'in_review' && task.assigneeId !== me.id && !can(me, 'task.approve')) {
      toast({ tone: 'error', title: 'Only the assignee can submit this' })
      return
    }
    if (!canEditTask(me, task) && task.assigneeId !== me.id) {
      toast({ tone: 'error', title: 'You do not have access to move this task' })
      return
    }
    setStatus(task.id, status)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter row — one row, above the board, as filters should be. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by title, code or tag…"
            leading={<Search size={14} />}
            className="h-9 text-[13px]"
          />
        </div>

        <Button variant={showFilters || filtersOn ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowFilters((v) => !v)}>
          <Filter size={14} />
          Filters
          {filtersOn && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent" />}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span className="num hidden text-[11px] text-fg-faint sm:inline">{tasks.length} shown</span>
          <Segmented
            layoutId="board-mode"
            size="sm"
            value={mode}
            onChange={(v) => setPrefs({ boardMode: v })}
            options={[
              { value: 'board', label: <KanbanSquare size={13} />, title: 'Board' },
              { value: 'list', label: <List size={13} />, title: 'List' },
              { value: 'timeline', label: <CalendarRange size={13} />, title: 'Timeline' },
            ]}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-line bg-panel-2/50"
          >
            <div className="flex flex-wrap items-end gap-3 px-4 py-3 sm:px-6">
              <div className="w-44">
                <Select label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-9 text-[13px]">
                  <option value="all">Everyone</option>
                  {state.users.filter((u) => u.active && u.role !== 'client').map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </div>
              <div className="w-44">
                <Select label="Tag" value={tag} onChange={(e) => setTag(e.target.value)} className="h-9 text-[13px]">
                  <option value="all">All tags</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </div>
              {filtersOn && (
                <Button variant="ghost" size="sm" onClick={() => { setAssignee('all'); setTag('all'); setQ('') }}>
                  <X size={13} /> Clear
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 overflow-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            {tasks.length === 0 ? (
              <EmptyState
                icon={<Search size={20} />}
                title={filtersOn ? 'Nothing matches those filters' : 'No work here yet'}
                body={filtersOn ? 'Loosen the filters, or clear them to see the whole board.' : 'Once a brief is opened it shows up on this board.'}
                action={
                  filtersOn ? (
                    <Button onClick={() => { setAssignee('all'); setTag('all'); setQ('') }}>Clear filters</Button>
                  ) : can(me, 'task.create') ? (
                    <Button variant="primary" onClick={() => setComposeOpen(true)}><Plus size={15} /> New brief</Button>
                  ) : undefined
                }
              />
            ) : mode === 'board' ? (
              <div className="flex h-full gap-3 overflow-x-auto p-4 sm:p-6">
                {COLUMNS.map((status) => {
                  const items = tasks.filter((t) => t.status === status).sort((a, b) => a.dueAt - b.dueAt)
                  const meta = STATUS_META[status]
                  return (
                    <div
                      key={status}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDropTarget(status)
                      }}
                      onDragLeave={() => setDropTarget((c) => (c === status ? null : c))}
                      onDrop={() => drop(status)}
                      className={cn(
                        'flex w-[290px] shrink-0 flex-col rounded-2xl border border-transparent transition-colors',
                        dropTarget === status && dragging && 'border-dashed border-accent bg-accent/4',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 px-2 pb-3 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: meta.tone }} />
                          <h2 className="text-[13px] font-semibold">{meta.label}</h2>
                          <span className="num text-[11px] text-fg-faint">{items.length}</span>
                        </div>
                        <span className="num text-[10px] text-fg-faint">
                          {items.reduce((s, t) => s + t.points, 0)}p
                        </span>
                      </div>

                      <div className="flex min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto px-1 pb-4">
                        <AnimatePresence mode="popLayout">
                          {items.map((t) => (
                            <TaskCard
                              key={t.id}
                              task={t}
                              assignee={state.users.find((u) => u.id === t.assigneeId)}
                              onOpen={() => openTask(t.id)}
                              draggable
                              dragging={dragging === t.id}
                              onDragStart={() => setDragging(t.id)}
                              onDragEnd={() => { setDragging(null); setDropTarget(null) }}
                            />
                          ))}
                        </AnimatePresence>
                        {items.length === 0 && (
                          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11px] text-fg-faint">
                            {dragging ? 'Drop here' : 'Empty'}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : mode === 'list' ? (
              <TaskList tasks={tasks} onOpen={openTask} />
            ) : (
              <Timeline tasks={tasks} onOpen={openTask} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* --------------------------------- List -------------------------------- */

function TaskList({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  const { state } = useApp()
  const sorted = [...tasks].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1
    if (b.status === 'done' && a.status !== 'done') return -1
    return a.dueAt - b.dueAt
  })

  return (
    <div className="p-4 sm:p-6">
      <div className="panel overflow-hidden p-0">
        <div className="hidden border-b border-line bg-panel-2/60 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-fg-faint md:grid md:grid-cols-[80px_1fr_150px_120px_110px_70px] md:gap-4">
          <span>Code</span><span>Task</span><span>Assignee</span><span>Status</span><span>Due</span><span className="text-right">Points</span>
        </div>
        {sorted.map((t, i) => {
          const user = state.users.find((u) => u.id === t.assigneeId)
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.012, 0.3), duration: 0.24 }}
              onClick={() => onOpen(t.id)}
              className="flex w-full items-center gap-4 border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-panel-2 md:grid md:grid-cols-[80px_1fr_150px_120px_110px_70px]"
            >
              <span className="num hidden text-[11px] text-fg-faint md:block">{t.code}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <PriorityMark priority={t.priority} />
                  <span className="truncate text-[13.5px] font-medium">{t.title}</span>
                </span>
                <span className="mt-1 flex items-center gap-2 md:hidden">
                  <Avatar user={user} size="xs" />
                  <span className="text-[11px] text-fg-faint">{user?.name}</span>
                  <DueChip task={t} />
                </span>
              </span>
              <span className="hidden items-center gap-2 md:flex">
                <Avatar user={user} size="xs" />
                <span className="truncate text-[12px] text-fg-muted">{user?.name}</span>
              </span>
              <span className="hidden md:block"><StatusPill status={t.status} /></span>
              <span className="hidden md:block"><DueChip task={t} /></span>
              <span className="num hidden text-right text-[12px] font-semibold md:block">{t.points}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------- Timeline ------------------------------ */

/**
 * A compressed Gantt across a rolling window. Every task the filters let
 * through is placed by its start and due dates, grouped by assignee, so
 * the shape of the next fortnight is legible at a glance.
 */
function Timeline({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  const { state } = useApp()
  const now = Date.now()

  const { from, days } = useMemo(() => {
    const starts = tasks.map((t) => t.startAt)
    const ends = tasks.map((t) => t.dueAt)
    const min = startOfDay(Math.min(now - 3 * DAY, ...starts))
    const max = startOfDay(Math.max(now + 10 * DAY, ...ends)) + DAY
    return { from: min, days: Math.min(70, Math.max(14, Math.round((max - min) / DAY))) }
  }, [tasks, now])

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const list = map.get(t.assigneeId) ?? []
      list.push(t)
      map.set(t.assigneeId, list)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [tasks])

  const colWidth = 44
  const width = days * colWidth
  const todayOffset = ((startOfDay(now) - from) / DAY) * colWidth

  return (
    <div className="overflow-x-auto p-4 sm:p-6">
      <div className="panel min-w-fit overflow-hidden p-0">
        {/* Date ruler */}
        <div className="sticky top-0 z-10 flex border-b border-line bg-panel-2/80 backdrop-blur">
          <div className="sticky left-0 z-10 w-[150px] shrink-0 border-r border-line bg-panel-2 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-fg-faint">
            Assignee
          </div>
          <div className="relative flex" style={{ width }}>
            {Array.from({ length: days }, (_, i) => {
              const ts = from + i * DAY
              const weekend = [0, 6].includes(new Date(ts).getDay())
              const isToday = startOfDay(now) === ts
              return (
                <div
                  key={i}
                  className={cn('shrink-0 border-r border-line py-2.5 text-center', weekend && 'bg-panel-3/40')}
                  style={{ width: colWidth }}
                >
                  <p className={cn('num text-[10px]', isToday ? 'font-bold text-accent-fg' : 'text-fg-faint')}>
                    {new Date(ts).getDate()}
                  </p>
                  <p className="text-[9px] uppercase text-fg-faint">{fmtDate(ts, { weekday: 'narrow', month: undefined, day: undefined })}</p>
                </div>
              )
            })}
          </div>
        </div>

        {grouped.map(([userId, list]) => {
          const user = state.users.find((u) => u.id === userId)
          return (
            <div key={userId} className="flex border-b border-line last:border-0">
              <div className="sticky left-0 z-10 flex w-[150px] shrink-0 items-center gap-2 border-r border-line bg-panel px-3 py-3">
                <Avatar user={user} size="xs" />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium">{user?.name.split(' ')[0]}</span>
                  <span className="num block text-[10px] text-fg-faint">{list.length} task{list.length === 1 ? '' : 's'}</span>
                </span>
              </div>

              <div className="relative py-2" style={{ width }}>
                {/* Today marker */}
                {todayOffset >= 0 && todayOffset <= width && (
                  <div className="pointer-events-none absolute inset-y-0 z-0 w-px bg-accent/50" style={{ left: todayOffset }} />
                )}
                {list
                  .sort((a, b) => a.startAt - b.startAt)
                  .map((t, row) => {
                    const left = ((startOfDay(t.startAt) - from) / DAY) * colWidth
                    const span = Math.max(1, Math.round((startOfDay(t.dueAt) - startOfDay(t.startAt)) / DAY) + 1)
                    const overdue = t.status !== 'done' && t.dueAt < now
                    const tone = overdue ? 'var(--c-rose)' : STATUS_META[t.status].tone
                    return (
                      <motion.button
                        key={t.id}
                        initial={{ opacity: 0, scaleX: 0.7 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{ delay: row * 0.03, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                          left: Math.max(0, left),
                          width: span * colWidth - 6,
                          background: `color-mix(in oklab, ${tone} 18%, transparent)`,
                          borderColor: `color-mix(in oklab, ${tone} 45%, transparent)`,
                          transformOrigin: 'left center',
                        }}
                        onClick={() => onOpen(t.id)}
                        className="relative mb-1.5 flex h-7 items-center gap-1.5 overflow-hidden rounded-lg border px-2 text-left transition-transform hover:scale-[1.01] hover:brightness-110"
                        title={`${t.code} · ${t.title}`}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone }} />
                        <span className="truncate text-[11px] font-medium">{t.title}</span>
                        <span className="num ml-auto shrink-0 text-[10px] text-fg-faint">{t.points}p</span>
                      </motion.button>
                    )
                  })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
