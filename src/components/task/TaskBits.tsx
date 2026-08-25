import { AlertTriangle, Clock, Mic, Paperclip, MessageSquare } from 'lucide-react'
import { motion } from 'motion/react'
import { fmtRemaining } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/components/ui/cn'
import type { Priority, Task, TaskStatus, User } from '@/types'

export const STATUS_META: Record<TaskStatus, { label: string; tone: string; short: string }> = {
  backlog: { label: 'Backlog', tone: 'var(--c-slate)', short: 'Queued' },
  in_progress: { label: 'In progress', tone: 'var(--c-cyan)', short: 'Working' },
  in_review: { label: 'In review', tone: 'var(--c-amber)', short: 'Review' },
  done: { label: 'Done', tone: 'var(--c-accent)', short: 'Signed off' },
}

export const PRIORITY_META: Record<Priority, { label: string; tone: string; rank: number }> = {
  low: { label: 'Low', tone: 'var(--c-slate)', rank: 0 },
  normal: { label: 'Normal', tone: 'var(--c-cyan)', rank: 1 },
  high: { label: 'High', tone: 'var(--c-amber)', rank: 2 },
  urgent: { label: 'Urgent', tone: 'var(--c-rose)', rank: 3 },
}

export function StatusPill({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', className)}
      style={{ background: `color-mix(in oklab, ${meta.tone} 14%, transparent)`, color: meta.tone }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.tone }} />
      {meta.label}
    </span>
  )
}

/** Priority as stacked bars — readable without relying on hue alone. */
export function PriorityMark({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority]
  return (
    <span className="inline-flex items-end gap-[2px]" title={`${meta.label} priority`} aria-label={`${meta.label} priority`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full transition-colors"
          style={{
            height: 4 + i * 2.5,
            background: i <= meta.rank ? meta.tone : 'var(--c-line-strong)',
          }}
        />
      ))}
    </span>
  )
}

export function DueChip({ task, now = Date.now() }: { task: Task; now?: number }) {
  if (task.status === 'done') {
    const onTime = (task.submittedAt ?? task.approvedAt ?? 0) <= task.dueAt
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px]', onTime ? 'text-accent-fg' : 'text-amber')}>
        {onTime ? 'On time' : 'Late'}
      </span>
    )
  }
  const { label, overdue, urgent } = fmtRemaining(task.dueAt, now)
  return (
    <span
      className={cn(
        'num inline-flex items-center gap-1 text-[11px] font-medium',
        overdue ? 'text-rose' : urgent ? 'text-amber' : 'text-fg-faint',
      )}
    >
      {overdue ? <AlertTriangle size={11} /> : <Clock size={11} />}
      {label}
    </span>
  )
}

export function TaskCard({
  task,
  assignee,
  onOpen,
  draggable,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  task: Task
  assignee?: User
  onOpen: () => void
  draggable?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  dragging?: boolean
}) {
  const voice = task.attachments.filter((a) => a.kind === 'audio').length
  const files = task.attachments.filter((a) => a.kind !== 'audio').length + task.deliverables.length
  const overdue = task.status !== 'done' && task.dueAt < Date.now()

  return (
    <motion.article
      layout
      layoutId={`task-${task.id}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      whileHover={{ y: -2 }}
      className={cn(
        'group cursor-pointer rounded-xl border bg-panel p-3.5 shadow-soft transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-lift',
        overdue ? 'border-rose/35' : 'border-line',
        draggable && 'active:cursor-grabbing',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="num text-[10px] tracking-wider text-fg-faint">{task.code}</span>
        <div className="flex items-center gap-2">
          <PriorityMark priority={task.priority} />
          <span className="num rounded-md bg-panel-3 px-1.5 py-0.5 text-[10px] font-semibold text-fg-muted">{task.points}p</span>
        </div>
      </div>

      <h3 className="line-clamp-2 text-[13.5px] font-medium leading-snug text-balance-tight">{task.title}</h3>

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] text-fg-faint">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <div className="flex items-center gap-2">
          <Avatar user={assignee} size="xs" />
          <span className="truncate text-[11px] text-fg-faint">{assignee?.name.split(' ')[0] ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2.5 text-fg-faint">
          {voice > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px]" title={`${voice} voice note${voice === 1 ? '' : 's'}`}>
              <Mic size={11} />
              {voice}
            </span>
          )}
          {files > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px]" title={`${files} attachment${files === 1 ? '' : 's'}`}>
              <Paperclip size={11} />
              {files}
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px]" title={`${task.comments.length} comments`}>
              <MessageSquare size={11} />
              {task.comments.length}
            </span>
          )}
          <DueChip task={task} />
        </div>
      </div>
    </motion.article>
  )
}
