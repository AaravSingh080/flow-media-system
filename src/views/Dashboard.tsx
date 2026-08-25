import { useMemo } from 'react'
import { motion } from 'motion/react'
import { ArrowUpRight, Clock3, Flame, Inbox, Plus, Sparkles, Target, Trophy } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { can, visibleTasks } from '@/lib/permissions'
import { dailySeries, leaderboard, levelFor, pulse, statsFor } from '@/lib/analytics'
import { DAY, fmtDate, plural, relTime } from '@/lib/format'
import { AreaTrend, RankedBars, StatusMeter } from '@/components/charts/Charts'
import { Avatar } from '@/components/ui/Avatar'
import { Button, EmptyState, Panel, Progress, SectionTitle } from '@/components/ui/primitives'
import { CountUp } from '@/components/ui/CountUp'
import { cn } from '@/components/ui/cn'
import { DueChip, PriorityMark, StatusPill } from '@/components/task/TaskBits'

export function Dashboard() {
  const { state, me } = useApp()
  const { openTask, go, setComposeOpen, askAssistant, openMember } = useUI()
  const now = Date.now()

  const p = useMemo(() => pulse(state, now), [state, now])
  const board = useMemo(() => leaderboard(state, now), [state, now])
  const mine = useMemo(() => (me ? statsFor(me.id, state.tasks, state.initiatives, now) : null), [me, state, now])
  const series = useMemo(() => dailySeries(state.tasks, 30, now), [state.tasks, now])

  if (!me || !mine) return null

  const myOpen = visibleTasks(me, state.tasks)
    .filter((t) => t.assigneeId === me.id && t.status !== 'done')
    .sort((a, b) => a.dueAt - b.dueAt)

  const needsMe = can(me, 'task.approve')
    ? state.tasks.filter((t) => t.status === 'in_review' && t.assigneeId !== me.id)
    : []

  const level = levelFor(mine.points)
  const toNext = level.next ? level.next - mine.points : 0
  const levelPct = level.next ? ((mine.points - level.min) / (level.next - level.min)) * 100 : 100

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const trend = series.map((d) => ({
    ts: d.ts,
    value: d.points,
    meta: `${plural(d.completed, 'task')} signed off`,
  }))

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 sm:p-6">
      {/* ---------------------------- hero ---------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="panel relative overflow-hidden p-0"
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--c-accent), transparent 70%)' }}
        />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-[12px] uppercase tracking-[0.14em] text-fg-faint">{greeting}</p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {me.name.split(' ')[0]}
            </h2>
            <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-fg-muted">
              {myOpen.length === 0
                ? 'Nothing is sitting with you right now. Good time to pick something up or log work you have already done.'
                : `You have ${plural(myOpen.length, 'open task')}${
                    mine.overdue ? `, ${mine.overdue} past due` : ''
                  }. Next deadline is ${fmtDate(myOpen[0].dueAt)} — ${myOpen[0].title}.`}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {can(me, 'task.create') && (
                <Button variant="primary" size="sm" onClick={() => setComposeOpen(true)}>
                  <Plus size={14} /> New brief
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => go('board')}>
                Open the board <ArrowUpRight size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => askAssistant("What's on my plate?")}>
                <Sparkles size={14} /> Ask the assistant
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-panel-2 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-fg-faint">Your points</p>
                <p className="mt-1 font-display text-4xl font-semibold leading-none">
                  <CountUp value={mine.points} />
                </p>
              </div>
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-fg">
                {level.name}
              </span>
            </div>

            <div className="mt-4">
              <Progress value={levelPct} />
              <p className="mt-1.5 text-[11px] text-fg-faint">
                {level.next ? `${toNext} points to ${levelFor(level.next).name}` : 'Top tier reached'}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
              <MiniStat label="Approved" value={mine.approved} />
              <MiniStat label="On time" value={Math.round(mine.onTimeRate * 100)} suffix="%" />
              <MiniStat label="Streak" value={mine.streak} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* --------------------------- stat row -------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Inbox size={15} />}
          label="Open work"
          value={p.open}
          sub={`${p.dueThisWeek} land within seven days`}
          onClick={() => go('board')}
          delay={0}
        />
        <StatCard
          icon={<Clock3 size={15} />}
          label="Waiting on review"
          value={p.inReview}
          sub={can(me, 'task.approve') ? `${needsMe.length} you can sign off` : 'Admins sign these off'}
          tone={p.inReview ? 'amber' : undefined}
          onClick={() => go('board')}
          delay={0.05}
        />
        <StatCard
          icon={<Flame size={15} />}
          label="Overdue"
          value={p.overdue}
          sub={p.overdue ? 'Needs attention today' : 'Everything inside its window'}
          tone={p.overdue ? 'rose' : undefined}
          onClick={() => askAssistant("What's overdue?")}
          delay={0.1}
        />
        <StatCard
          icon={<Trophy size={15} />}
          label="Points this week"
          value={p.pointsThisWeek}
          sub={`${p.completedThisWeek} tasks signed off`}
          onClick={() => go('scoreboard')}
          delay={0.15}
        />
      </div>

      {/* ---------------------------- panels --------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Panel>
            <SectionTitle hint="Points released per day, last 30 days">Delivery trend</SectionTitle>
            <AreaTrend data={trend} label="Points released" valueSuffix=" pts" />
            <div className="mt-4 border-t border-line pt-4">
              <StatusMeter
                segments={[
                  { label: 'Backlog', value: state.tasks.filter((t) => t.status === 'backlog').length, tone: 'var(--c-slate)' },
                  { label: 'In progress', value: state.tasks.filter((t) => t.status === 'in_progress').length, tone: 'var(--c-cyan)' },
                  { label: 'In review', value: state.tasks.filter((t) => t.status === 'in_review').length, tone: 'var(--c-amber)' },
                  { label: 'Done', value: state.tasks.filter((t) => t.status === 'done').length, tone: 'var(--c-accent)' },
                ]}
              />
            </div>
          </Panel>

          <Panel>
            <SectionTitle
              hint={myOpen.length ? 'Sorted by deadline' : undefined}
              action={
                <Button variant="ghost" size="sm" onClick={() => go('board')}>
                  All work <ArrowUpRight size={13} />
                </Button>
              }
            >
              Your queue
            </SectionTitle>

            {myOpen.length === 0 ? (
              <EmptyState
                icon={<Target size={20} />}
                title="Your queue is clear"
                body="Nothing assigned to you is open. If you have done work off your own bat, log it as an initiative and get it scored."
                action={<Button size="sm" onClick={() => go('initiatives')}>Log an initiative</Button>}
              />
            ) : (
              <ul className="space-y-1">
                {myOpen.slice(0, 6).map((t, i) => (
                  <motion.li
                    key={t.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                  >
                    <button
                      onClick={() => openTask(t.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-panel-2"
                    >
                      <PriorityMark priority={t.priority} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{t.title}</span>
                        <span className="num mt-0.5 block text-[11px] text-fg-faint">
                          {t.code} · {t.points} pts
                        </span>
                      </span>
                      <StatusPill status={t.status} />
                      <DueChip task={t} />
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          {needsMe.length > 0 && (
            <Panel className="border-amber/30">
              <SectionTitle hint="Points are released when you sign off">Waiting on you</SectionTitle>
              <ul className="space-y-1">
                {needsMe.slice(0, 5).map((t) => {
                  const u = state.users.find((x) => x.id === t.assigneeId)
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => openTask(t.id)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-panel-2"
                      >
                        <Avatar user={u} size="xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{t.title}</span>
                          <span className="block text-[11px] text-fg-faint">
                            {u?.name.split(' ')[0]} · handed in {relTime(t.submittedAt ?? t.updatedAt)}
                          </span>
                        </span>
                        <span className="num shrink-0 text-[12px] font-semibold text-amber">{t.points}p</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}

          <Panel>
            <SectionTitle
              hint="Lifetime released points"
              action={
                <Button variant="ghost" size="sm" onClick={() => go('scoreboard')}>
                  Full board <ArrowUpRight size={13} />
                </Button>
              }
            >
              Standing
            </SectionTitle>
            <RankedBars
              unit="pts"
              rows={board.slice(0, 6).map((s) => {
                const u = state.users.find((x) => x.id === s.userId)
                return {
                  id: s.userId,
                  label: u?.name ?? '—',
                  value: s.points,
                  sub: `${plural(s.approved, 'task')} · ${Math.round(s.onTimeRate * 100)}% on time`,
                  flag: s.overdue ? { label: `${s.overdue} overdue`, tone: 'rose' as const } : undefined,
                  leading: (
                    <button onClick={() => { openMember(s.userId); go('team') }} className="shrink-0">
                      <Avatar user={u} size="xs" />
                    </button>
                  ),
                }
              })}
            />
          </Panel>

          <Panel>
            <SectionTitle hint="Nobody assigned these — they were brought forward">Recent initiatives</SectionTitle>
            {state.initiatives.slice(0, 4).map((i) => {
              const u = state.users.find((x) => x.id === i.proposedBy)
              return (
                <button
                  key={i.id}
                  onClick={() => go('initiatives')}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-panel-2"
                >
                  <Avatar user={u} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{i.title}</span>
                    <span className="block text-[11px] text-fg-faint">
                      {u?.name.split(' ')[0]} · {relTime(i.createdAt)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'num shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                      i.status === 'approved' ? 'bg-accent-soft text-accent-fg' : i.status === 'pending' ? 'bg-amber/14 text-amber' : 'bg-panel-3 text-fg-faint',
                    )}
                  >
                    {i.status === 'approved' ? `+${i.points}` : i.status === 'pending' ? 'pending' : 'declined'}
                  </span>
                </button>
              )
            })}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <p className="num text-lg font-semibold leading-none">
        <CountUp value={value} suffix={suffix} />
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-fg-faint">{label}</p>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
  onClick,
  delay = 0,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub: string
  tone?: 'amber' | 'rose'
  onClick?: () => void
  delay?: number
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="panel group p-4 text-left transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-lift"
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg',
            tone === 'rose' ? 'bg-rose/12 text-rose' : tone === 'amber' ? 'bg-amber/14 text-amber' : 'bg-panel-3 text-fg-faint',
          )}
        >
          {icon}
        </span>
        <ArrowUpRight size={14} className="text-fg-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="num mt-3 text-2xl font-semibold leading-none">
        <CountUp value={value} />
      </p>
      <p className="mt-1.5 text-[12px] font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-fg-faint">{sub}</p>
    </motion.button>
  )
}

export { DAY }
