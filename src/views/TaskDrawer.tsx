import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  CheckCircle2, ChevronDown, CornerUpLeft, Send, Sparkles, Star, Trash2, X,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { can, canApproveTask, canEditTask, canSubmitTask } from '@/lib/permissions'
import { fmtDateTime, fmtFullDate, relTime } from '@/lib/format'
import { Drawer, Modal } from '@/components/ui/Modal'
import { Button, Segmented } from '@/components/ui/primitives'
import { Label, Textarea } from '@/components/ui/Field'
import { PointsField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { AttachmentGrid } from '@/components/media/AttachmentGrid'
import { Dropzone } from '@/components/media/Dropzone'
import { VoiceRecorder } from '@/components/media/VoiceRecorder'
import { cn } from '@/components/ui/cn'
import { DueChip, PRIORITY_META, PriorityMark, STATUS_META, StatusPill } from '@/components/task/TaskBits'
import type { Attachment, TaskStatus } from '@/types'

type Tab = 'brief' | 'delivery' | 'thread'

export function TaskDrawer() {
  const { state, me, setStatus, submitTask, approveTask, reopenTask, reassignTask, commentOnTask, deleteTask } = useApp()
  const { taskId, openTask } = useUI()
  const toast = useToast()

  const task = useMemo(() => state.tasks.find((t) => t.id === taskId) ?? null, [state.tasks, taskId])
  const [tab, setTab] = useState<Tab>('brief')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!taskId) return
    const t = state.tasks.find((x) => x.id === taskId)
    setTab(t?.status === 'in_review' || t?.status === 'done' ? 'delivery' : 'brief')
  }, [taskId, state.tasks])

  if (!me) return null
  const open = !!task

  const assignee = task ? state.users.find((u) => u.id === task.assigneeId) : undefined
  const author = task ? state.users.find((u) => u.id === task.createdBy) : undefined

  return (
    <>
      <Drawer open={open} onClose={() => openTask(null)} label="Task detail" width="sm:w-[620px]">
        {task && (
          <>
            <header className="shrink-0 border-b border-line px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="num text-[11px] tracking-wider text-fg-faint">{task.code}</span>
                    <StatusPill status={task.status} />
                    <span className="inline-flex items-center gap-1 text-[11px] text-fg-faint">
                      <PriorityMark priority={task.priority} />
                      {PRIORITY_META[task.priority].label}
                    </span>
                  </div>
                  <h2 className="text-[17px] font-semibold leading-snug text-balance-tight">{task.title}</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openTask(null)} aria-label="Close">
                  <X size={16} />
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <Meta label="Assignee">
                  <div className="flex items-center gap-1.5">
                    <Avatar user={assignee} size="xs" />
                    <span className="truncate text-[12px] font-medium">{assignee?.name.split(' ')[0]}</span>
                  </div>
                </Meta>
                <Meta label="Due">
                  <div className="space-y-0.5">
                    <p className="text-[12px] font-medium">{fmtDateTime(task.dueAt)}</p>
                    <DueChip task={task} />
                  </div>
                </Meta>
                <Meta label="Value">
                  <p className="num text-[12px] font-semibold">
                    {task.pointsAwarded ?? task.points}
                    <span className="ml-1 text-[10px] font-normal text-fg-faint">
                      {task.pointsAwarded !== undefined ? 'released' : 'on approval'}
                    </span>
                  </p>
                </Meta>
              </div>

              <div className="mt-4">
                <Segmented
                  layoutId="task-tabs"
                  size="sm"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'brief', label: 'Brief' },
                    { value: 'delivery', label: task.status === 'done' ? 'Delivery' : 'Hand-in' },
                    { value: 'thread', label: `Thread${task.comments.length ? ` · ${task.comments.length}` : ''}` },
                  ]}
                />
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {tab === 'brief' && (
                    <div className="space-y-5">
                      {task.brief ? (
                        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg-muted">{task.brief}</p>
                      ) : (
                        <p className="text-[13px] italic text-fg-faint">No written brief — the instruction is in the attachments below.</p>
                      )}

                      {task.attachments.length > 0 && (
                        <div>
                          <Label>Briefing material</Label>
                          <AttachmentGrid items={task.attachments} />
                        </div>
                      )}

                      {task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {task.tags.map((t) => (
                            <span key={t} className="rounded-md bg-panel-2 px-2 py-1 text-[11px] text-fg-faint">{t}</span>
                          ))}
                        </div>
                      )}

                      <div className="rounded-xl border border-line bg-panel-2 p-4">
                        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-fg-faint">Activity</p>
                        <ol className="space-y-3">
                          {[...task.activity].reverse().map((entry) => {
                            const actor = state.users.find((u) => u.id === entry.actorId)
                            return (
                              <li key={entry.id} className="flex gap-2.5">
                                <Avatar user={actor} size="xs" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] leading-snug">
                                    <span className="font-medium">{actor?.name.split(' ')[0] ?? 'Someone'}</span>{' '}
                                    <span className="text-fg-muted">{entry.message}</span>
                                  </p>
                                  <p className="text-[10px] text-fg-faint">{relTime(entry.at)}</p>
                                </div>
                              </li>
                            )
                          })}
                        </ol>
                      </div>

                      {canEditTask(me, task) && (
                        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                          <div className="flex-1">
                            <Label>Reassign</Label>
                            <select
                              value={task.assigneeId}
                              onChange={(e) => {
                                reassignTask(task.id, e.target.value)
                                toast({ tone: 'success', title: 'Reassigned' })
                              }}
                              className="h-9 w-full rounded-lg border border-line bg-panel-2 px-3 text-[13px] focus:border-accent focus:outline-none"
                            >
                              {state.users.filter((u) => u.active && u.role !== 'client').map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                          </div>
                          {can(me, 'task.deleteAny') && (
                            <Button variant="ghost" size="icon" className="mt-5 text-rose" onClick={() => setConfirmDelete(true)} aria-label="Delete task">
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'delivery' && (
                    <DeliveryTab
                      taskId={task.id}
                      onSubmit={() => setSubmitOpen(true)}
                      onApprove={() => setApproveOpen(true)}
                      onReopen={(reason) => {
                        reopenTask(task.id, reason)
                        toast({ tone: 'info', title: 'Sent back for another pass' })
                      }}
                    />
                  )}

                  {tab === 'thread' && (
                    <ThreadTab
                      taskId={task.id}
                      onSend={(body, atts) => {
                        commentOnTask(task.id, body, atts)
                      }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <footer className="shrink-0 border-t border-line px-5 py-3.5">
              <div className="flex items-center gap-2">
                {task.status !== 'done' && (task.assigneeId === me.id || canEditTask(me, task)) && (
                  <StatusSwitcher
                    value={task.status}
                    onChange={(s) => setStatus(task.id, s)}
                  />
                )}
                <div className="ml-auto flex items-center gap-2">
                  {canSubmitTask(me, task) && task.status !== 'in_review' && (
                    <Button variant="primary" size="sm" onClick={() => setSubmitOpen(true)}>
                      <CheckCircle2 size={14} /> Mark done
                    </Button>
                  )}
                  {canApproveTask(me, task) && (
                    <Button variant="primary" size="sm" onClick={() => setApproveOpen(true)}>
                      <Sparkles size={14} /> Review &amp; release
                    </Button>
                  )}
                  {task.status === 'in_review' && task.assigneeId === me.id && !can(me, 'task.approve') && (
                    <span className="text-[11px] text-fg-faint">Waiting on an admin to sign off.</span>
                  )}
                  {task.status === 'in_review' && can(me, 'task.approve') && task.assigneeId === me.id && (
                    <span className="text-[11px] text-fg-faint">Another admin has to approve your own work.</span>
                  )}
                </div>
              </div>
            </footer>
          </>
        )}
      </Drawer>

      {task && (
        <SubmitModal
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
          onSubmit={(note, files) => {
            submitTask(task.id, note, files)
            setSubmitOpen(false)
            setTab('delivery')
            toast({
              tone: 'success',
              title: 'Handed in for review',
              body: files.length ? `${files.length} file${files.length === 1 ? '' : 's'} attached.` : 'Your write-up has been sent to the admins.',
            })
          }}
        />
      )}

      {task && (
        <ApproveModal
          open={approveOpen}
          defaultPoints={task.points}
          taskTitle={task.title}
          assigneeName={assignee?.name ?? ''}
          onClose={() => setApproveOpen(false)}
          onApprove={(points, rating, note) => {
            approveTask(task.id, { points, rating, note })
            setApproveOpen(false)
            toast({ tone: 'success', title: `${points} points released to ${assignee?.name.split(' ')[0]}` })
          }}
        />
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this task?"
        subtitle="The brief, its attachments and its history go with it. This cannot be undone."
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (task) deleteTask(task.id)
                setConfirmDelete(false)
                openTask(null)
                toast({ tone: 'info', title: 'Task deleted' })
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-muted">
          {task?.code} — {task?.title}
        </p>
        {author && <p className="mt-2 text-[12px] text-fg-faint">Briefed by {author.name} on {fmtFullDate(task!.createdAt)}.</p>}
      </Modal>
    </>
  )
}

/* ------------------------------ sub-views ------------------------------ */

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel-2 px-3 py-2">
      <p className="mb-1 text-[10px] uppercase tracking-wider text-fg-faint">{label}</p>
      {children}
    </div>
  )
}

function StatusSwitcher({ value, onChange }: { value: TaskStatus; onChange: (s: TaskStatus) => void }) {
  const [open, setOpen] = useState(false)
  const options: TaskStatus[] = ['backlog', 'in_progress']
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[value].tone }} />
        {STATUS_META[value].label}
        <ChevronDown size={13} />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="panel absolute bottom-[calc(100%+6px)] left-0 z-20 w-44 p-1.5 shadow-lift"
          >
            {options.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-panel-2"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[s].tone }} />
                {STATUS_META[s].label}
              </button>
            ))}
            <p className="border-t border-line px-2.5 pb-1 pt-2 text-[10px] leading-relaxed text-fg-faint">
              Review and Done are reached by handing in and signing off.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DeliveryTab({
  taskId,
  onSubmit,
  onApprove,
  onReopen,
}: {
  taskId: string
  onSubmit: () => void
  onApprove: () => void
  onReopen: (reason: string) => void
}) {
  const { state, me } = useApp()
  const task = state.tasks.find((t) => t.id === taskId)!
  const [reason, setReason] = useState('')
  const [reopening, setReopening] = useState(false)
  const assignee = state.users.find((u) => u.id === task.assigneeId)
  const approver = task.approvedBy ? state.users.find((u) => u.id === task.approvedBy) : undefined

  if (!task.submittedAt) {
    return (
      <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
        <p className="text-[13px] font-medium">Nothing handed in yet</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[12px] leading-relaxed text-fg-faint">
          When the work is finished, {task.assigneeId === me?.id ? 'attach the final files here' : `${assignee?.name.split(' ')[0]} attaches the final files here`} — or
          just marks it done with a write-up if there is no file to hand over.
        </p>
        {canSubmitTask(me ?? null, task) && (
          <Button variant="primary" size="sm" className="mt-5" onClick={onSubmit}>
            <CheckCircle2 size={14} /> Mark done
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-panel-2 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Avatar user={assignee} size="xs" />
          <p className="text-[12px]">
            <span className="font-medium">{assignee?.name.split(' ')[0]}</span>
            <span className="text-fg-muted"> handed this in {relTime(task.submittedAt)}</span>
          </p>
          <span className={cn('num ml-auto text-[11px]', task.submittedAt <= task.dueAt ? 'text-accent-fg' : 'text-amber')}>
            {task.submittedAt <= task.dueAt ? 'on time' : 'late'}
          </span>
        </div>
        {task.completionNote ? (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">{task.completionNote}</p>
        ) : (
          <p className="text-[12px] italic text-fg-faint">Marked done without a write-up.</p>
        )}
      </div>

      {task.deliverables.length > 0 && (
        <div>
          <Label hint={`${task.deliverables.length} file${task.deliverables.length === 1 ? '' : 's'}`}>Final product</Label>
          <AttachmentGrid items={task.deliverables} />
        </div>
      )}

      {task.status === 'done' && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'color-mix(in oklab, var(--c-accent) 30%, transparent)', background: 'color-mix(in oklab, var(--c-accent) 6%, transparent)' }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-fg">
              <CheckCircle2 size={13} /> Approved by {approver?.name.split(' ')[0] ?? 'an admin'}
            </p>
            <span className="num text-[13px] font-semibold text-accent-fg">+{task.pointsAwarded ?? task.points}</span>
          </div>
          {task.reviewRating && (
            <div className="mb-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={13} className={n <= task.reviewRating! ? 'text-amber' : 'text-line-strong'} fill={n <= task.reviewRating! ? 'currentColor' : 'none'} />
              ))}
              <span className="ml-1 text-[11px] text-fg-faint">{task.reviewRating}/5</span>
            </div>
          )}
          {task.reviewNote && <p className="text-[13px] leading-relaxed text-fg-muted">{task.reviewNote}</p>}
        </div>
      )}

      {canApproveTask(me ?? null, task) && (
        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={onApprove}>
              <Sparkles size={14} /> Review &amp; release points
            </Button>
            <Button variant="outline" onClick={() => setReopening((v) => !v)}>
              <CornerUpLeft size={14} /> Send back
            </Button>
          </div>
          <AnimatePresence>
            {reopening && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <Textarea
                  label="What needs another pass?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Be specific — this is what they will work from."
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    onReopen(reason)
                    setReason('')
                    setReopening(false)
                  }}
                >
                  Send it back
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function ThreadTab({ taskId, onSend }: { taskId: string; onSend: (body: string, atts: Attachment[]) => void }) {
  const { state, me } = useApp()
  const task = state.tasks.find((t) => t.id === taskId)!
  const [body, setBody] = useState('')
  const [atts, setAtts] = useState<Attachment[]>([])

  if (!me) return null

  return (
    <div className="space-y-4">
      {task.comments.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12px] text-fg-faint">
          No messages yet. Questions about the brief go here so the answer stays with the task.
        </p>
      )}

      {task.comments.map((c) => {
        const author = state.users.find((u) => u.id === c.authorId)
        const mine = c.authorId === me.id
        return (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
            <Avatar user={author} size="sm" />
            <div className={cn('min-w-0 max-w-[80%]', mine && 'items-end')}>
              <div className={cn('flex items-baseline gap-2', mine && 'flex-row-reverse')}>
                <span className="text-[12px] font-medium">{author?.name.split(' ')[0]}</span>
                <span className="text-[10px] text-fg-faint">{relTime(c.createdAt)}</span>
              </div>
              {c.body && (
                <div className={cn('mt-1 rounded-xl px-3 py-2 text-[13px] leading-relaxed', mine ? 'bg-accent/12 text-fg' : 'bg-panel-2 text-fg-muted')}>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </div>
              )}
              {c.attachments.length > 0 && <AttachmentGrid className="mt-2" items={c.attachments} columns="grid-cols-2" />}
            </div>
          </motion.div>
        )
      })}

      <div className="space-y-2 border-t border-line pt-4">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Ask something, or leave a note for whoever picks this up…"
        />
        <VoiceRecorder
          ownerId={me.id}
          notes={atts.filter((a) => a.kind === 'audio')}
          onRecorded={(a) => setAtts((x) => [...x, a])}
          onRemove={(id) => setAtts((x) => x.filter((a) => a.id !== id))}
        />
        <Dropzone compact ownerId={me.id} onAdd={(items) => setAtts((x) => [...x, ...items])} label="Attach a file" hint="" />
        <AttachmentGrid items={atts.filter((a) => a.kind !== 'audio')} onRemove={(id) => setAtts((x) => x.filter((a) => a.id !== id))} columns="grid-cols-3" />
        <Button
          variant="primary"
          size="sm"
          disabled={!body.trim() && !atts.length}
          onClick={() => {
            onSend(body.trim(), atts)
            setBody('')
            setAtts([])
          }}
        >
          <Send size={13} /> Send
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------- modals ------------------------------- */

function SubmitModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (note: string, files: Attachment[]) => void
}) {
  const { me } = useApp()
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])

  useEffect(() => {
    if (open) {
      setNote('')
      setFiles([])
    }
  }, [open])

  if (!me) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hand this in"
      subtitle="Attach the final product if there is one. If there isn't, a write-up on its own is enough."
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSubmit(note.trim(), files)} disabled={!note.trim() && !files.length}>
            Submit for review
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label hint="what you did, and anything the reviewer should know">Your write-up</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Delivered the grade in ProRes and H.264. Rebuilt the node tree so the interview and product passes are separate…"
          />
        </div>
        <div>
          <Label hint={files.length ? `${files.length} attached` : 'optional'}>Final product</Label>
          <Dropzone ownerId={me.id} onAdd={(items) => setFiles((f) => [...f, ...items])} label="Drop the deliverable" hint="video, stills, documents — up to 220 MB each" />
          <AttachmentGrid className="mt-3" items={files} onRemove={(id) => setFiles((f) => f.filter((x) => x.id !== id))} />
        </div>
      </div>
    </Modal>
  )
}

function ApproveModal({
  open,
  defaultPoints,
  taskTitle,
  assigneeName,
  onClose,
  onApprove,
}: {
  open: boolean
  defaultPoints: number
  taskTitle: string
  assigneeName: string
  onClose: () => void
  onApprove: (points: number, rating: number, note: string) => void
}) {
  const [points, setPoints] = useState(defaultPoints)
  const [rating, setRating] = useState(4)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setPoints(defaultPoints)
      setRating(4)
      setNote('')
    }
  }, [open, defaultPoints])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sign off and release points"
      subtitle={`${taskTitle} — ${assigneeName}`}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onApprove(points, rating, note.trim())}>
            Release {points} points
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <PointsField value={points} onChange={setPoints} />
        {points !== defaultPoints && (
          <p className="text-[12px] text-amber">
            Adjusted from the briefed {defaultPoints}. Worth saying why in the note below.
          </p>
        )}

        <div>
          <Label hint="how the delivery landed">Rating</Label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} out of 5`} className="transition-transform hover:scale-110">
                <Star size={22} className={n <= rating ? 'text-amber' : 'text-line-strong'} fill={n <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
            <span className="ml-2 text-[12px] text-fg-faint">
              {['', 'Needs work', 'Below par', 'Solid', 'Strong', 'Exceptional'][rating]}
            </span>
          </div>
        </div>

        <Textarea
          label="Review note"
          hint="goes to the assignee"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="What worked, and anything to carry into the next one…"
        />
      </div>
    </Modal>
  )
}
