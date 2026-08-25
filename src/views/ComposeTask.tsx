import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarClock, Users } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { ROLES, can } from '@/lib/permissions'
import { DAY } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { DateTimeField, Input, Label, PointsField, Select, TagInput, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { Avatar, RoleTag } from '@/components/ui/Avatar'
import { Dropzone } from '@/components/media/Dropzone'
import { AttachmentGrid } from '@/components/media/AttachmentGrid'
import { VoiceRecorder } from '@/components/media/VoiceRecorder'
import { cn } from '@/components/ui/cn'
import type { Attachment, Priority } from '@/types'

const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent']

export function ComposeTask() {
  const { me, state, createTask } = useApp()
  const { composeOpen, setComposeOpen, openTask } = useUI()
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [points, setPoints] = useState(25)
  const [startAt, setStartAt] = useState(Date.now())
  const [dueAt, setDueAt] = useState(Date.now() + 3 * DAY)
  const [tags, setTags] = useState<string[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [touched, setTouched] = useState(false)

  const suggestions = useMemo(() => [...new Set(state.tasks.flatMap((t) => t.tags))].slice(0, 10), [state.tasks])
  const assignable = state.users.filter((u) => u.active && u.role !== 'client')

  useEffect(() => {
    if (!composeOpen) return
    setTitle('')
    setBrief('')
    setAssigneeId(me?.id ?? '')
    setPriority('normal')
    setPoints(25)
    setStartAt(Date.now())
    setDueAt(Date.now() + 3 * DAY)
    setTags([])
    setAttachments([])
    setTouched(false)
  }, [composeOpen, me?.id])

  if (!me) return null

  const voiceNotes = attachments.filter((a) => a.kind === 'audio')
  const media = attachments.filter((a) => a.kind !== 'audio')
  // A brief is valid with words, with a voice note, or with media — any of
  // the three carries the instruction, which is the whole point.
  const hasContent = brief.trim().length > 0 || attachments.length > 0
  const validTitle = title.trim().length >= 3
  const validDates = dueAt > startAt
  const canSubmit = validTitle && hasContent && validDates && !!assigneeId

  const submit = () => {
    setTouched(true)
    if (!canSubmit) return
    const task = createTask({ title, brief, assigneeId, points, priority, startAt, dueAt, tags, attachments })
    setComposeOpen(false)
    toast({
      tone: 'success',
      title: `${task.code} assigned to ${state.users.find((u) => u.id === assigneeId)?.name.split(' ')[0]}`,
      body: `${points} points, due ${new Date(dueAt).toLocaleDateString()}`,
    })
    openTask(task.id)
  }

  const assignee = state.users.find((u) => u.id === assigneeId)

  return (
    <Modal
      open={composeOpen}
      onClose={() => setComposeOpen(false)}
      title="New brief"
      subtitle="Write it, say it, or show it — whatever gets the instruction across fastest."
      width="max-w-3xl"
      footer={
        <>
          <span className="mr-auto text-[11px] text-fg-faint">
            {can(me, 'task.setPoints') ? `Worth ${points} points on approval` : 'An admin sets the point value'}
          </span>
          <Button variant="ghost" onClick={() => setComposeOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={touched && !canSubmit}>
            Assign brief
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Northbeam launch film — final grade"
          error={touched && !validTitle ? 'Give the task a title of at least three characters.' : undefined}
          autoFocus
        />

        <div>
          <Textarea
            label="Written brief"
            hint="optional if you record or attach one"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={5}
            placeholder="What needs doing, what good looks like, and anything they should not change…"
          />
        </div>

        <div>
          <Label hint={voiceNotes.length ? `${voiceNotes.length} attached` : 'faster than typing'}>Voice brief</Label>
          <VoiceRecorder
            ownerId={me.id}
            notes={voiceNotes}
            onRecorded={(att) => setAttachments((a) => [...a, att])}
            onRemove={(id) => setAttachments((a) => a.filter((x) => x.id !== id))}
          />
        </div>

        <div>
          <Label hint={media.length ? `${media.length} attached` : 'references, footage, stills'}>Media</Label>
          <Dropzone ownerId={me.id} onAdd={(items) => setAttachments((a) => [...a, ...items])} />
          <AttachmentGrid
            className="mt-3"
            items={media}
            onRemove={(id) => setAttachments((a) => a.filter((x) => x.id !== id))}
          />
        </div>

        {touched && !hasContent && (
          <p className="flex items-center gap-2 rounded-lg bg-rose/10 px-3 py-2 text-[12px] text-rose">
            <AlertCircle size={13} />
            A brief needs something in it — write a line, record a note, or attach a reference.
          </p>
        )}

        <div className="border-t border-line pt-5">
          <Label>Assign to</Label>
          <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {assignable.map((u) => {
              const active = u.id === assigneeId
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setAssigneeId(u.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                    active ? 'border-accent bg-accent/6' : 'border-line hover:border-line-strong hover:bg-panel-2',
                  )}
                >
                  <Avatar user={u} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium">{u.name}</span>
                      {u.id === me.id && <span className="text-[10px] text-fg-faint">(you)</span>}
                    </span>
                    <span className="block truncate text-[11px] text-fg-faint">{u.title}</span>
                  </span>
                  <RoleTag role={u.role} />
                </button>
              )
            })}
          </div>
          {assignee && assignee.role === 'admin' && assignee.id !== me.id && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-fg-faint">
              <Users size={11} /> Admins can be assigned work like anyone else.
            </p>
          )}
        </div>

        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <DateTimeField label="Starts" hint="when work can start" value={startAt} onChange={setStartAt} />
          <DateTimeField
            label="Due"
            hint={validDates ? `${Math.max(1, Math.round((dueAt - startAt) / DAY))} day window` : 'must be after the start'}
            value={dueAt}
            onChange={setDueAt}
            invalid={!validDates}
            min={startAt}
          />
          <div className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 7, 14].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDueAt(startAt + d * DAY)}
                  className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-faint transition-colors hover:border-line-strong hover:text-fg-muted"
                >
                  <CalendarClock size={11} /> {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
            ))}
          </Select>
          <div>
            <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
          </div>
        </div>

        {can(me, 'task.setPoints') ? (
          <PointsField value={points} onChange={setPoints} />
        ) : (
          <p className="rounded-xl border border-line bg-panel-2 px-3.5 py-3 text-[12px] text-fg-faint">
            As {ROLES[me.role].label.toLowerCase()} you can brief work, but an admin sets what it is worth. This will go out
            provisionally at {points} points.
          </p>
        )}
      </div>
    </Modal>
  )
}
