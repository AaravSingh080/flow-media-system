import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Activity, Gauge, PieChart, Users2 } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { dailySeries, leaderboard, pointsByTag, pulse } from '@/lib/analytics'
import { DAY, fmtDuration, plural, startOfDay } from '@/lib/format'
import { AreaTrend, RankedBars, RadialScore, StatusMeter } from '@/components/charts/Charts'
import { Avatar } from '@/components/ui/Avatar'
import { Panel, SectionTitle, Segmented } from '@/components/ui/primitives'
import { CountUp } from '@/components/ui/CountUp'
import { cn } from '@/components/ui/cn'

type Range = '14' | '30' | '90'

export function Analytics() {
  const { state } = useApp()
  const [range, setRange] = useState<Range>('30')
  const now = Date.now()
  const days = Number(range)

  const p = useMemo(() => pulse(state, now), [state, now])
  const board = useMemo(() => leaderboard(state, now), [state, now])
  const series = useMemo(() => dailySeries(state.tasks, days, now), [state.tasks, days, now])
  const tags = useMemo(() => pointsByTag(state.tasks), [state.tasks])

  const approved = state.tasks.filter((t) => t.approvedAt)
  const onTime = approved.filter((t) => (t.submittedAt ?? t.approvedAt ?? 0) <= t.dueAt).length
  const onTimeRate = approved.length ? Math.round((onTime / approved.length) * 100) : 0

  const turnarounds = state.tasks
    .filter((t) => t.submittedAt)
    .map((t) => (t.submittedAt ?? 0) - t.startAt)
    .filter((ms) => ms > 0)
  const avgTurnaround = turnarounds.length ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length : 0

  const windowStart = startOfDay(now) - (days - 1) * DAY
  const inWindow = approved.filter((t) => (t.approvedAt ?? 0) >= windowStart)
  const pointsInWindow = inWindow.reduce((s, t) => s + (t.pointsAwarded ?? t.points), 0)

  // Delivered vs opened, so a rising backlog is visible rather than implied.
  const opened = state.tasks.filter((t) => t.createdAt >= windowStart).length
  const balance = opened ? Math.round((inWindow.length / opened) * 100) : 100

  return (
    <div className="mx-auto max-w-[1300px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Analytics</h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            Throughput, punctuality, and where the studio's effort actually goes.
          </p>
        </div>
        <Segmented
          layoutId="analytics-range"
          size="sm"
          value={range}
          onChange={setRange}
          options={[
            { value: '14', label: '14 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Activity size={15} />} label="Points released" value={pointsInWindow} sub={`across ${plural(inWindow.length, 'task')}`} />
        <Kpi icon={<Gauge size={15} />} label="On-time delivery" value={onTimeRate} suffix="%" sub={`${onTime} of ${approved.length} approved`} />
        <Kpi icon={<Users2 size={15} />} label="Avg turnaround" valueText={avgTurnaround ? fmtDuration(avgTurnaround) : '—'} sub="brief opened to hand-in" />
        <Kpi
          icon={<PieChart size={15} />}
          label="Delivered vs opened"
          value={balance}
          suffix="%"
          sub={balance >= 95 ? 'Keeping pace with intake' : 'Opening faster than closing'}
          tone={balance < 70 ? 'amber' : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <SectionTitle hint={`Points released per day over ${days} days`}>Throughput</SectionTitle>
          <AreaTrend
            data={series.map((d) => ({ ts: d.ts, value: d.points, meta: `${plural(d.completed, 'task')} approved · ${plural(d.opened, 'brief')} opened` }))}
            height={190}
            label="Points released"
            valueSuffix=" pts"
          />
        </Panel>

        <Panel>
          <SectionTitle hint="Every live task by state">Pipeline</SectionTitle>
          <div className="py-2">
            <StatusMeter
              segments={[
                { label: 'Backlog', value: state.tasks.filter((t) => t.status === 'backlog').length, tone: 'var(--c-slate)' },
                { label: 'In progress', value: state.tasks.filter((t) => t.status === 'in_progress').length, tone: 'var(--c-cyan)' },
                { label: 'In review', value: state.tasks.filter((t) => t.status === 'in_review').length, tone: 'var(--c-amber)' },
                { label: 'Done', value: state.tasks.filter((t) => t.status === 'done').length, tone: 'var(--c-accent)' },
              ]}
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <Mini label="Overdue" value={p.overdue} tone={p.overdue ? 'rose' : undefined} />
            <Mini label="Due this week" value={p.dueThisWeek} />
            <Mini label="Awaiting review" value={p.inReview} tone={p.inReview ? 'amber' : undefined} />
            <Mini label="Unreleased points" value={p.unassignedPoints} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel>
          <SectionTitle hint="Approved points by member">Contribution</SectionTitle>
          <RankedBars
            unit="pts"
            rows={board.slice(0, 8).map((s) => {
              const u = state.users.find((x) => x.id === s.userId)
              return {
                id: s.userId,
                label: u?.name ?? '—',
                value: s.points,
                sub: `${plural(s.approved, 'task')} · ${Math.round(s.onTimeRate * 100)}% on time`,
                leading: <Avatar user={u} size="xs" />,
              }
            })}
          />
        </Panel>

        <Panel>
          <SectionTitle hint="Open tasks per member — who to lean on next">Live workload</SectionTitle>
          <RankedBars
            unit="open"
            tone="var(--c-cyan)"
            rows={[...board]
              .sort((a, b) => b.active - a.active)
              .slice(0, 8)
              .map((s) => {
                const u = state.users.find((x) => x.id === s.userId)
                return {
                  id: s.userId,
                  label: u?.name ?? '—',
                  value: s.active,
                  sub: `${s.reliability}/100 reliability`,
                  flag: s.overdue ? { label: `${s.overdue} overdue`, tone: 'rose' as const } : undefined,
                  leading: <Avatar user={u} size="xs" />,
                }
              })}
            emptyLabel="Nothing open."
          />
        </Panel>

        <Panel>
          <SectionTitle hint="Where approved points came from">Effort by tag</SectionTitle>
          <RankedBars
            unit="pts"
            tone="var(--c-violet)"
            rows={tags.slice(0, 8).map((t) => ({
              id: t.tag,
              label: t.tag,
              value: t.points,
              sub: plural(t.count, 'task'),
            }))}
            emptyLabel="No approved work is tagged yet."
          />
        </Panel>
      </div>

      <Panel>
        <SectionTitle hint="Composite of punctuality, ratings, throughput and initiative">Reliability across the team</SectionTitle>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {board
            .filter((s) => s.approved > 0)
            .sort((a, b) => b.reliability - a.reliability)
            .slice(0, 4)
            .map((s, i) => {
              const u = state.users.find((x) => x.id === s.userId)
              return (
                <motion.div
                  key={s.userId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                  className="flex flex-col items-center"
                >
                  <RadialScore
                    value={s.reliability}
                    size={110}
                    label={u?.name}
                    caption={`${Math.round(s.onTimeRate * 100)}% on time · ${plural(s.approved, 'task')}`}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <Avatar user={u} size="xs" />
                    <span className="text-[12.5px] font-medium">{u?.name}</span>
                  </div>
                </motion.div>
              )
            })}
        </div>
        {board.every((s) => s.approved === 0) && (
          <p className="py-8 text-center text-[13px] text-fg-faint">No approved work yet, so there is nothing to score.</p>
        )}
      </Panel>
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  valueText,
  suffix = '',
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value?: number
  valueText?: string
  suffix?: string
  sub: string
  tone?: 'amber' | 'rose'
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="panel p-4">
      <span
        className={cn(
          'grid h-8 w-8 place-items-center rounded-lg',
          tone === 'rose' ? 'bg-rose/12 text-rose' : tone === 'amber' ? 'bg-amber/14 text-amber' : 'bg-panel-3 text-fg-faint',
        )}
      >
        {icon}
      </span>
      <p className="num mt-3 text-2xl font-semibold leading-none">
        {valueText ?? <CountUp value={value ?? 0} suffix={suffix} />}
      </p>
      <p className="mt-1.5 text-[12px] font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] text-fg-faint">{sub}</p>
    </motion.div>
  )
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'rose' }) {
  return (
    <div>
      <p className={cn('num text-lg font-semibold leading-none', tone === 'rose' ? 'text-rose' : tone === 'amber' ? 'text-amber' : '')}>
        <CountUp value={value} />
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-fg-faint">{label}</p>
    </div>
  )
}
