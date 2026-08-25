import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Crown, Info, Medal, Timer, TrendingUp } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { leaderboard, levelFor, type MemberStats } from '@/lib/analytics'
import { DAY, fmtDuration, plural } from '@/lib/format'
import { ROLES } from '@/lib/permissions'
import { Avatar, RoleTag } from '@/components/ui/Avatar'
import { Panel, Progress, Segmented } from '@/components/ui/primitives'
import { CountUp } from '@/components/ui/CountUp'
import { RankedBars } from '@/components/charts/Charts'
import { cn } from '@/components/ui/cn'

type Window = 'all' | '30' | '7'

export function Scoreboard() {
  const { state } = useApp()
  const { openMember, go } = useUI()
  const [window, setWindow] = useState<Window>('all')
  const now = Date.now()

  // Windowing rebuilds the ranking from tasks approved inside the range,
  // so "this week" is a real measure rather than a slice of a lifetime total.
  const rows = useMemo(() => {
    if (window === 'all') return leaderboard(state, now)
    const cutoff = now - Number(window) * DAY
    const scoped = { ...state, tasks: state.tasks.filter((t) => !t.approvedAt || t.approvedAt >= cutoff) }
    return leaderboard(scoped, now)
  }, [state, window, now])

  const ranked = rows.filter((r) => r.points > 0)
  const podium = ranked.slice(0, 3)
  const total = ranked.reduce((s, r) => s + r.points, 0)

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Contribution scoreboard</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-fg-muted">
            Points are attached to a task when it is briefed and released when an admin signs the work off. Light jobs sit
            around 10–20, heavy ones 45 and up. Work nobody assigned is scored through Initiatives.
          </p>
        </div>
        <Segmented
          layoutId="score-window"
          size="sm"
          value={window}
          onChange={setWindow}
          options={[
            { value: 'all', label: 'All time' },
            { value: '30', label: '30 days' },
            { value: '7', label: '7 days' },
          ]}
        />
      </div>

      {/* --------------------------- podium --------------------------- */}
      {podium.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {podium.map((s, i) => {
            const u = state.users.find((x) => x.id === s.userId)
            const level = levelFor(s.points)
            const place = ['First', 'Second', 'Third'][i]
            return (
              <motion.button
                key={s.userId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4 }}
                onClick={() => { openMember(s.userId); go('team') }}
                className={cn(
                  'panel relative overflow-hidden p-5 text-left transition-shadow hover:shadow-lift',
                  i === 0 && 'sm:-mt-2 sm:pb-7',
                )}
                style={i === 0 ? { borderColor: 'color-mix(in oklab, var(--c-accent) 40%, transparent)' } : undefined}
              >
                {i === 0 && (
                  <div
                    className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-2xl"
                    style={{ background: 'radial-gradient(circle, var(--c-accent), transparent 70%)' }}
                  />
                )}
                <div className="relative flex items-start justify-between">
                  <Avatar user={u} size="lg" ring={i === 0} />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-3 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-fg-faint">
                    {i === 0 ? <Crown size={11} className="text-amber" /> : <Medal size={11} />}
                    {place}
                  </span>
                </div>

                <p className="relative mt-3 truncate text-[15px] font-semibold">{u?.name}</p>
                <p className="relative flex items-center gap-1.5 text-[11px] text-fg-faint">
                  <RoleTag role={u?.role ?? 'member'} />
                  {u?.title}
                </p>

                <p className="relative mt-4 font-display text-3xl font-semibold leading-none">
                  <CountUp value={s.points} />
                  <span className="ml-1.5 text-[12px] font-normal text-fg-faint">pts</span>
                </p>

                <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-faint">
                  <span>{plural(s.approved, 'task')} approved</span>
                  <span>{Math.round(s.onTimeRate * 100)}% on time</span>
                  <span>{level.name}</span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel padded={false}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h3 className="text-[15px] font-semibold">Full standing</h3>
            <span className="num text-[11px] text-fg-faint">{total} points released</span>
          </div>

          <div className="divide-y divide-line">
            {rows.map((s, i) => (
              <Row key={s.userId} stats={s} rank={i + 1} onOpen={() => { openMember(s.userId); go('team') }} />
            ))}
            {rows.length === 0 && <p className="px-5 py-12 text-center text-[13px] text-fg-faint">No members to rank yet.</p>}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <h3 className="mb-1 text-[15px] font-semibold">Most reliable</h3>
            <p className="mb-4 text-[11px] text-fg-faint">
              Punctuality, sign-off ratings, throughput and initiative, combined.
            </p>
            <RankedBars
              unit="/100"
              rows={[...rows]
                .filter((r) => r.approved > 0)
                .sort((a, b) => b.reliability - a.reliability)
                .slice(0, 6)
                .map((s) => {
                  const u = state.users.find((x) => x.id === s.userId)
                  return {
                    id: s.userId,
                    label: u?.name ?? '—',
                    value: s.reliability,
                    sub: `${Math.round(s.onTimeRate * 100)}% on time · ${s.ratedCount ? `${s.avgRating.toFixed(1)}★` : 'unrated'}`,
                    leading: <Avatar user={u} size="xs" />,
                  }
                })}
              emptyLabel="No approved work to score yet."
            />
          </Panel>

          <Panel>
            <h3 className="mb-4 text-[15px] font-semibold">How scoring works</h3>
            <ul className="space-y-3 text-[12.5px] leading-relaxed text-fg-muted">
              <Rule icon={<TrendingUp size={13} />} title="The briefer sets the value">
                Points scale with weight, not time spent. A quick caption pass is not worth what a three-day grade is.
              </Rule>
              <Rule icon={<Timer size={13} />} title="Released on approval, not hand-in">
                Nothing lands on the board until an admin signs it off — and nobody signs off their own work.
              </Rule>
              <Rule icon={<Info size={13} />} title="Unassigned work still counts">
                Bring it to Initiatives, describe what you did, and an admin decides what it was worth.
              </Rule>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Rule({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-panel-3 text-fg-faint">{icon}</span>
      <span>
        <span className="block font-medium text-fg">{title}</span>
        <span className="text-fg-faint">{children}</span>
      </span>
    </li>
  )
}

function Row({ stats, rank, onOpen }: { stats: MemberStats; rank: number; onOpen: () => void }) {
  const { state } = useApp()
  const u = state.users.find((x) => x.id === stats.userId)
  const level = levelFor(stats.points)
  const pct = level.next ? ((stats.points - level.min) / (level.next - level.min)) * 100 : 100

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.02, 0.3) }}
      onClick={onOpen}
      className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-panel-2"
    >
      <span className={cn('num w-6 shrink-0 text-right text-[13px] font-semibold', rank <= 3 ? 'text-accent-fg' : 'text-fg-faint')}>
        {rank}
      </span>
      <Avatar user={u} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13.5px] font-medium">{u?.name}</p>
          <RoleTag role={u?.role ?? 'member'} />
        </div>
        <p className="mt-0.5 truncate text-[11px] text-fg-faint">
          {ROLES[u?.role ?? 'member'].label} · {plural(stats.approved, 'approved task')}
          {stats.initiativesApproved > 0 && ` · ${plural(stats.initiativesApproved, 'initiative')}`}
        </p>
        <div className="mt-1.5 max-w-[220px]">
          <Progress value={pct} height={3} />
        </div>
      </div>

      <div className="hidden w-24 shrink-0 text-right sm:block">
        <p className="num text-[12px] font-medium">{Math.round(stats.onTimeRate * 100)}%</p>
        <p className="text-[10px] text-fg-faint">on time</p>
      </div>
      <div className="hidden w-24 shrink-0 text-right md:block">
        <p className="num text-[12px] font-medium">{stats.avgTurnaround ? fmtDuration(stats.avgTurnaround) : '—'}</p>
        <p className="text-[10px] text-fg-faint">turnaround</p>
      </div>

      <div className="w-20 shrink-0 text-right">
        <p className="num text-[15px] font-semibold">{stats.points}</p>
        <p className="text-[10px] text-fg-faint">{level.name}</p>
      </div>
    </motion.button>
  )
}
