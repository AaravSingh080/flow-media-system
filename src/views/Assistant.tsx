import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Bot, RotateCcw, Sparkles } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { STARTER_PROMPTS, ask } from '@/lib/assistant'
import { statsFor } from '@/lib/analytics'
import { fmtDuration, plural, relTime } from '@/lib/format'
import { uid } from '@/lib/id'
import { ROLES } from '@/lib/permissions'
import { Avatar, RoleTag } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/primitives'
import { RadialScore } from '@/components/charts/Charts'
import { cn } from '@/components/ui/cn'
import { DueChip, StatusPill } from '@/components/task/TaskBits'
import type { AssistantCard, ChatMessage } from '@/types'

export function Assistant() {
  const { state, me } = useApp()
  const { assistantSeed, clearSeed, openTask, openMember, go } = useUI()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const greeting = useMemo<ChatMessage | null>(() => {
    if (!me) return null
    const s = statsFor(me.id, state.tasks, state.initiatives)
    const open = state.tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done').length
    return {
      id: 'greeting',
      role: 'assistant',
      at: Date.now(),
      text:
        `I read straight from this workspace — the same tasks, deadlines and points everything else here shows, so I can't tell you anything the board doesn't already know.\n\n` +
        `You're signed in as ${me.name} (${ROLES[me.role].label}) with ${plural(open, 'open task')} and ${s.points} points banked. Ask me anything about the work or the people.`,
      suggestions: STARTER_PROMPTS,
    }
  }, [me, state.tasks, state.initiatives])

  const send = (raw: string) => {
    const query = raw.trim()
    if (!query || !me) return
    const userMsg: ChatMessage = { id: uid('m'), role: 'user', text: query, at: Date.now() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setThinking(true)

    // A beat of latency — an instant answer reads as canned rather than considered.
    window.setTimeout(() => {
      const reply = ask(state, me, query)
      setMessages((m) => [
        ...m,
        { id: uid('m'), role: 'assistant', at: Date.now(), text: reply.text, cards: reply.cards, suggestions: reply.suggestions },
      ])
      setThinking(false)
    }, 260 + Math.random() * 220)
  }

  useEffect(() => {
    if (assistantSeed) {
      send(assistantSeed)
      clearSeed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantSeed])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  if (!me) return null
  const shown = greeting ? [greeting, ...messages] : messages

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <div ref={scroller} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6">
        {shown.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            onSuggestion={send}
            onOpenTask={openTask}
            onOpenMember={(id) => { openMember(id); go('team') }}
          />
        ))}

        <AnimatePresence>
          {thinking && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3">
              <AssistantAvatar />
              <div className="flex h-9 items-center gap-1.5 rounded-2xl rounded-tl-md bg-panel-2 px-4">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-fg-faint"
                    animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-line bg-bg/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-panel-2 p-2 transition-colors focus-within:border-accent">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={1}
            placeholder="Ask about the work, a deadline, or how someone works…"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] outline-none placeholder:text-fg-faint"
          />
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" onClick={() => setMessages([])} aria-label="Clear conversation">
                <RotateCcw size={15} />
              </Button>
            )}
            <Button variant="primary" size="icon" onClick={() => send(input)} disabled={!input.trim()} aria-label="Send">
              <ArrowUp size={16} />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10.5px] text-fg-faint">
          Answers are computed from this workspace only — nothing is sent anywhere.
        </p>
      </div>
    </div>
  )
}

function AssistantAvatar() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fg text-bg">
      <Bot size={16} />
    </span>
  )
}

function Bubble({
  message,
  onSuggestion,
  onOpenTask,
  onOpenMember,
}: {
  message: ChatMessage
  onSuggestion: (q: string) => void
  onOpenTask: (id: string) => void
  onOpenMember: (id: string) => void
}) {
  const { me } = useApp()
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {isUser ? <Avatar user={me ?? undefined} size="sm" /> : <AssistantAvatar />}

      <div className={cn('min-w-0 max-w-[85%] space-y-3', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed',
            isUser ? 'rounded-tr-md bg-accent text-on-accent' : 'rounded-tl-md bg-panel-2 text-fg-muted',
          )}
        >
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>

        {message.cards?.map((card, i) => (
          <Card key={i} card={card} onOpenTask={onOpenTask} onOpenMember={onOpenMember} />
        ))}

        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestion(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] text-fg-muted transition-colors hover:border-line-strong hover:bg-panel-2 hover:text-fg"
              >
                <Sparkles size={11} className="text-fg-faint" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function Card({
  card,
  onOpenTask,
  onOpenMember,
}: {
  card: AssistantCard
  onOpenTask: (id: string) => void
  onOpenMember: (id: string) => void
}) {
  const { state } = useApp()

  if (card.type === 'tasks') {
    const tasks = card.ids.map((id) => state.tasks.find((t) => t.id === id)).filter(Boolean)
    if (!tasks.length) return null
    return (
      <div className="w-full overflow-hidden rounded-xl border border-line bg-panel">
        <p className="border-b border-line px-3.5 py-2 text-[11px] font-medium uppercase tracking-wider text-fg-faint">{card.label}</p>
        {tasks.map((t) => {
          const u = state.users.find((x) => x.id === t!.assigneeId)
          return (
            <button
              key={t!.id}
              onClick={() => onOpenTask(t!.id)}
              className="flex w-full items-center gap-2.5 border-b border-line px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-panel-2"
            >
              <Avatar user={u} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{t!.title}</span>
                <span className="num block text-[11px] text-fg-faint">{t!.code} · {t!.points} pts</span>
              </span>
              <StatusPill status={t!.status} />
              <DueChip task={t!} />
            </button>
          )
        })}
      </div>
    )
  }

  if (card.type === 'members') {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-line bg-panel">
        <p className="border-b border-line px-3.5 py-2 text-[11px] font-medium uppercase tracking-wider text-fg-faint">{card.label}</p>
        {card.ids.map((id) => {
          const u = state.users.find((x) => x.id === id)
          if (!u) return null
          return (
            <button
              key={id}
              onClick={() => onOpenMember(id)}
              className="flex w-full items-center gap-2.5 border-b border-line px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-panel-2"
            >
              <Avatar user={u} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{u.name}</span>
                <span className="block truncate text-[11px] text-fg-faint">{u.title}</span>
              </span>
              <RoleTag role={u.role} />
            </button>
          )
        })}
      </div>
    )
  }

  if (card.type === 'scoreboard') {
    const max = Math.max(1, ...card.rows.map((r) => r.value))
    return (
      <div className="w-full rounded-xl border border-line bg-panel p-3.5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-fg-faint">{card.label}</p>
        <ol className="space-y-2">
          {card.rows.map((r, i) => {
            const u = state.users.find((x) => x.id === r.userId)
            return (
              <li key={r.userId}>
                <button onClick={() => onOpenMember(r.userId)} className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-panel-2">
                  <span className="num w-4 shrink-0 text-right text-[11px] text-fg-faint">{i + 1}</span>
                  <Avatar user={u} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px] font-medium">{u?.name}</span>
                      <span className="num shrink-0 text-[12px] font-semibold">
                        {r.value}
                        <span className="ml-1 text-[10px] font-normal text-fg-faint">{card.unit}</span>
                      </span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-panel-3">
                      <motion.span
                        className="block h-full rounded-full bg-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${(r.value / max) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 90, damping: 20, delay: i * 0.04 }}
                      />
                    </span>
                    {r.sub && <span className="mt-1 block text-[10.5px] text-fg-faint">{r.sub}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  if (card.type === 'ethic') {
    const u = state.users.find((x) => x.id === card.userId)
    if (!u) return null
    const s = statsFor(u.id, state.tasks, state.initiatives)
    return (
      <div className="w-full rounded-xl border border-line bg-panel p-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <RadialScore value={s.reliability} size={104} label={u.name} />
          <div className="min-w-0 flex-1">
            <button onClick={() => onOpenMember(u.id)} className="flex items-center gap-2 text-left">
              <Avatar user={u} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{u.name}</span>
                <span className="block truncate text-[11px] text-fg-faint">{u.title}</span>
              </span>
            </button>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              {[
                { k: 'On time', v: s.approved ? `${Math.round(s.onTimeRate * 100)}%` : '—' },
                { k: 'Avg rating', v: s.ratedCount ? `${s.avgRating.toFixed(1)}★` : '—' },
                { k: 'Turnaround', v: s.avgTurnaround ? fmtDuration(s.avgTurnaround) : '—' },
                { k: 'Streak', v: String(s.streak) },
              ].map((m) => (
                <div key={m.k}>
                  <dd className="num text-[13px] font-semibold leading-none">{m.v}</dd>
                  <dt className="mt-1 text-[10px] uppercase tracking-wider text-fg-faint">{m.k}</dt>
                </div>
              ))}
            </dl>
            <p className="num mt-3 text-[10.5px] text-fg-faint">
              Last active {s.lastActiveAt ? relTime(s.lastActiveAt) : 'unknown'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
      {card.items.map((s) => (
        <div key={s.label} className="rounded-xl border border-line bg-panel px-3 py-2.5">
          <p
            className={cn(
              'num text-[15px] font-semibold leading-none',
              s.tone === 'rose' ? 'text-rose' : s.tone === 'amber' ? 'text-amber' : '',
            )}
          >
            {s.value}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-fg-faint">{s.label}</p>
        </div>
      ))}
    </div>
  )
}
