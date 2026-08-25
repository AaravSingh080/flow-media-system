import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Lightbulb, Plus, ThumbsDown, X } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { can, canDecideInitiative } from '@/lib/permissions'
import { plural, relTime } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button, EmptyState, Panel, Segmented } from '@/components/ui/primitives'
import { Input, Label, PointsField, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { Avatar, RoleTag } from '@/components/ui/Avatar'
import { Dropzone } from '@/components/media/Dropzone'
import { AttachmentGrid } from '@/components/media/AttachmentGrid'
import { VoiceRecorder } from '@/components/media/VoiceRecorder'
import { CountUp } from '@/components/ui/CountUp'
import { cn } from '@/components/ui/cn'
import type { Attachment, Initiative } from '@/types'

type Filter = 'all' | 'pending' | 'approved' | 'declined'

export function Initiatives() {
  const { state, me, createInitiative, decideInitiative } = useApp()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [composing, setComposing] = useState(false)
  const [deciding, setDeciding] = useState<Initiative | null>(null)

  const items = useMemo(() => {
    const list = filter === 'all' ? state.initiatives : state.initiatives.filter((i) => i.status === filter)
    return [...list].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (b.status === 'pending' && a.status !== 'pending') return 1
      return b.createdAt - a.createdAt
    })
  }, [state.initiatives, filter])

  if (!me) return null

  const pending = state.initiatives.filter((i) => i.status === 'pending').length
  const approved = state.initiatives.filter((i) => i.status === 'approved')
  const awarded = approved.reduce((s, i) => s + (i.points ?? 0), 0)

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-4 sm:p-6">
      <div className="panel relative overflow-hidden p-6">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--c-violet), transparent 70%)' }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet/12 px-2.5 py-1 text-[11px] font-medium text-violet">
              <Lightbulb size={12} /> Self-directed work
            </span>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
              Not every useful thing starts as a brief
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
              If you spotted something and fixed it, built a tool nobody asked for, or did the unglamorous work that saves
              everyone else time — log it here. An admin reads what you did and decides what it was worth.
            </p>
            {can(me, 'initiative.create') && (
              <Button variant="primary" size="sm" className="mt-5" onClick={() => setComposing(true)}>
                <Plus size={14} /> Log what you did
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-5 sm:gap-8">
            <Figure label="Pending" value={pending} tone={pending ? 'amber' : undefined} />
            <Figure label="Scored" value={approved.length} />
            <Figure label="Points awarded" value={awarded} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Segmented
          layoutId="init-filter"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'pending', label: `Pending${pending ? ` · ${pending}` : ''}` },
            { value: 'approved', label: 'Scored' },
            { value: 'declined', label: 'Declined' },
          ]}
        />
        <span className="num text-[11px] text-fg-faint">{items.length} shown</span>
      </div>

      {items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Lightbulb size={20} />}
            title={filter === 'all' ? 'Nothing logged yet' : `No ${filter} submissions`}
            body="Work that nobody assigned still counts. Describe it, attach what you made, and it goes into the queue for scoring."
            action={can(me, 'initiative.create') ? <Button size="sm" onClick={() => setComposing(true)}>Log an initiative</Button> : undefined}
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {items.map((item, i) => {
              const author = state.users.find((u) => u.id === item.proposedBy)
              const decider = item.decidedBy ? state.users.find((u) => u.id === item.decidedBy) : undefined
              const canDecide = canDecideInitiative(me, item.proposedBy) && item.status === 'pending'

              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: Math.min(i * 0.03, 0.2), duration: 0.3 }}
                  className={cn('panel p-5', item.status === 'pending' && 'border-amber/30')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar user={author} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-medium">{author?.name}</p>
                          <RoleTag role={author?.role ?? 'member'} />
                        </div>
                        <p className="num text-[11px] text-fg-faint">
                          {item.code} · {relTime(item.createdAt)}
                          {item.effortHours ? ` · ~${plural(item.effortHours, 'hour')}` : ''}
                        </p>
                      </div>
                    </div>

                    <StatusChip item={item} />
                  </div>

                  <h3 className="mt-4 text-[15px] font-semibold leading-snug text-balance-tight">{item.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">{item.description}</p>

                  {item.attachments.length > 0 && <AttachmentGrid className="mt-4" items={item.attachments} />}

                  {item.status !== 'pending' && item.decisionNote && (
                    <div
                      className="mt-4 rounded-xl border p-3.5"
                      style={{
                        borderColor: item.status === 'approved' ? 'color-mix(in oklab, var(--c-accent) 28%, transparent)' : 'var(--c-line)',
                        background: item.status === 'approved' ? 'color-mix(in oklab, var(--c-accent) 5%, transparent)' : 'var(--c-panel-2)',
                      }}
                    >
                      <p className="mb-1 text-[11px] font-medium text-fg-faint">
                        {decider?.name.split(' ')[0] ?? 'An admin'} · {item.status === 'approved' ? `awarded ${item.points} points` : 'declined'}
                      </p>
                      <p className="text-[13px] leading-relaxed text-fg-muted">{item.decisionNote}</p>
                    </div>
                  )}

                  {canDecide && (
                    <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                      <Button variant="primary" size="sm" onClick={() => setDeciding(item)}>
                        <Check size={14} /> Score this
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          decideInitiative(item.id, 'declined', 0, 'Not scored this round.')
                          toast({ tone: 'info', title: 'Declined' })
                        }}
                      >
                        <ThumbsDown size={14} /> Decline
                      </Button>
                    </div>
                  )}

                  {item.status === 'pending' && !canDecide && (
                    <p className="mt-4 border-t border-line pt-3 text-[11px] text-fg-faint">
                      {item.proposedBy === me.id ? 'Waiting on an admin to put a value on this.' : 'An admin will score this.'}
                    </p>
                  )}
                </motion.article>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <ComposeInitiative
        open={composing}
        onClose={() => setComposing(false)}
        onSubmit={(input) => {
          createInitiative(input)
          setComposing(false)
          toast({ tone: 'success', title: 'Logged for scoring', body: 'An admin will put a point value on it.' })
        }}
      />

      <DecideModal
        item={deciding}
        onClose={() => setDeciding(null)}
        onDecide={(points, note) => {
          if (!deciding) return
          decideInitiative(deciding.id, 'approved', points, note)
          toast({ tone: 'success', title: `${points} points awarded` })
          setDeciding(null)
        }}
      />
    </div>
  )
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: 'amber' }) {
  return (
    <div>
      <p className={cn('num font-display text-2xl font-semibold leading-none', tone === 'amber' && 'text-amber')}>
        <CountUp value={value} />
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-fg-faint">{label}</p>
    </div>
  )
}

function StatusChip({ item }: { item: Initiative }) {
  if (item.status === 'approved') {
    return (
      <span className="num inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-fg">
        <Check size={12} /> +{item.points} pts
      </span>
    )
  }
  if (item.status === 'declined') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-panel-3 px-2.5 py-1 text-[11px] font-medium text-fg-faint">
        <X size={12} /> Declined
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/14 px-2.5 py-1 text-[11px] font-medium text-amber">
      <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-amber" />
      Awaiting a value
    </span>
  )
}

function ComposeInitiative({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: { title: string; description: string; attachments: Attachment[]; effortHours?: number }) => void
}) {
  const { me } = useApp()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])

  if (!me) return null
  const valid = title.trim().length >= 3 && description.trim().length >= 10

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log self-directed work"
      subtitle="Describe what you did and why it mattered. The clearer it is, the easier it is to score fairly."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              onSubmit({
                title: title.trim(),
                description: description.trim(),
                attachments,
                effortHours: hours ? Number(hours) : undefined,
              })
              setTitle('')
              setDescription('')
              setHours('')
              setAttachments([])
            }}
          >
            Submit for scoring
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input label="What did you do?" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rebuilt the project template in Premiere" autoFocus />
        <Textarea
          label="The detail"
          hint="what, why, and who it helps"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Nobody asked for this, but every edit was starting from a blank slate…"
        />
        <Input
          label="Rough effort"
          hint="optional"
          type="number"
          min={0}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Hours spent"
        />
        <div>
          <Label hint="optional">Talk it through</Label>
          <VoiceRecorder
            ownerId={me.id}
            notes={attachments.filter((a) => a.kind === 'audio')}
            onRecorded={(a) => setAttachments((x) => [...x, a])}
            onRemove={(id) => setAttachments((x) => x.filter((a) => a.id !== id))}
          />
        </div>
        <div>
          <Label hint="optional">Show it</Label>
          <Dropzone ownerId={me.id} onAdd={(items) => setAttachments((x) => [...x, ...items])} label="Attach proof of the work" hint="screenshots, exports, documents" />
          <AttachmentGrid className="mt-3" items={attachments.filter((a) => a.kind !== 'audio')} onRemove={(id) => setAttachments((x) => x.filter((a) => a.id !== id))} />
        </div>
      </div>
    </Modal>
  )
}

function DecideModal({
  item,
  onClose,
  onDecide,
}: {
  item: Initiative | null
  onClose: () => void
  onDecide: (points: number, note: string) => void
}) {
  const { state } = useApp()
  const [points, setPoints] = useState(20)
  const [note, setNote] = useState('')
  const author = item ? state.users.find((u) => u.id === item.proposedBy) : undefined

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Put a value on this"
      subtitle={item ? `${item.title} — ${author?.name}` : undefined}
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onDecide(points, note.trim())}>
            Award {points} points
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {item?.effortHours && (
          <p className="rounded-lg bg-panel-2 px-3 py-2 text-[12px] text-fg-muted">
            {author?.name.split(' ')[0]} logged roughly {plural(item.effortHours, 'hour')} on this.
          </p>
        )}
        <PointsField value={points} onChange={setPoints} />
        <Textarea
          label="Why this value"
          hint="the author sees this"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Saves every editor twenty minutes a project and removes a whole class of colour mistakes…"
        />
      </div>
    </Modal>
  )
}
