import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, Check, Mail, Shield, Sparkles, UserPlus, X } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useUI } from '@/store/ui'
import { ROLES, ROLE_CAPS, ROLE_LIST, can } from '@/lib/permissions'
import { ethicSummary, levelFor, statsFor } from '@/lib/analytics'
import { fmtDuration, fmtFullDate, plural, relTime } from '@/lib/format'
import { Avatar, RoleTag } from '@/components/ui/Avatar'
import { Button, EmptyState, Panel, Progress, SectionTitle } from '@/components/ui/primitives'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal, Drawer } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { RadialScore } from '@/components/charts/Charts'
import { CountUp } from '@/components/ui/CountUp'
import { cn } from '@/components/ui/cn'
import { DueChip, StatusPill } from '@/components/task/TaskBits'
import type { Role } from '@/types'

const CAP_LABELS: Record<string, string> = {
  'task.create': 'Open briefs',
  'task.assign.any': 'Assign to anyone',
  'task.setPoints': 'Set point values',
  'task.approve': 'Approve & release points',
  'task.editAny': 'Edit any brief',
  'task.deleteAny': 'Delete tasks',
  'task.viewAll': 'See the whole board',
  'initiative.create': 'Log self-directed work',
  'initiative.decide': 'Score self-directed work',
  'team.viewAll': 'Browse the team',
  'team.manage': 'Manage members',
  'analytics.view': 'View analytics',
  'settings.manage': 'Workspace settings',
}

export function Team() {
  const { state, me } = useApp()
  const { memberId, openMember } = useUI()
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [inviteOpen, setInviteOpen] = useState(false)

  const members = useMemo(() => {
    const list = state.users.filter((u) => roleFilter === 'all' || u.role === roleFilter)
    return [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  }, [state.users, roleFilter])

  if (!me) return null
  const rolesPresent = ROLE_LIST.filter((r) => state.users.some((u) => u.role === r.id))

  return (
    <div className="mx-auto max-w-[1300px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">The team</h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            {plural(state.users.filter((u) => u.active).length, 'active member')} across {plural(rolesPresent.length, 'role')}.
            Every role sees a different slice of the system.
          </p>
        </div>
        {can(me, 'team.manage') && (
          <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} /> Add member
          </Button>
        )}
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        <Chip active={roleFilter === 'all'} onClick={() => setRoleFilter('all')}>
          Everyone <span className="num opacity-60">{state.users.length}</span>
        </Chip>
        {rolesPresent.map((r) => (
          <Chip key={r.id} active={roleFilter === r.id} onClick={() => setRoleFilter(r.id)} accent={r.accent}>
            {r.label} <span className="num opacity-60">{state.users.filter((u) => u.role === r.id).length}</span>
          </Chip>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((u, i) => {
          const s = statsFor(u.id, state.tasks, state.initiatives)
          const level = levelFor(s.points)
          return (
            <motion.button
              key={u.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -3 }}
              onClick={() => openMember(u.id)}
              className={cn('panel p-5 text-left transition-shadow hover:shadow-lift', !u.active && 'opacity-55')}
            >
              <div className="flex items-start justify-between gap-3">
                <Avatar user={u} size="lg" />
                <div className="text-right">
                  <p className="num text-lg font-semibold leading-none">{s.points}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-fg-faint">{level.name}</p>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-2 text-[14px] font-semibold">
                <span className="truncate">{u.name}</span>
                {!u.active && <span className="rounded bg-panel-3 px-1.5 py-0.5 text-[10px] text-fg-faint">inactive</span>}
              </p>
              <p className="flex items-center gap-1.5 text-[11.5px] text-fg-faint">
                <RoleTag role={u.role} />
                <span className="truncate">{u.title}</span>
              </p>

              <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-fg-muted">{u.bio || 'No bio yet.'}</p>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
                <Cell label="Approved" value={String(s.approved)} />
                <Cell label="On time" value={s.approved ? `${Math.round(s.onTimeRate * 100)}%` : '—'} />
                <Cell label="Open" value={String(s.active)} tone={s.overdue ? 'rose' : undefined} />
              </div>
            </motion.button>
          )
        })}
      </div>

      {members.length === 0 && (
        <Panel>
          <EmptyState icon={<UserPlus size={20} />} title="Nobody in this role yet" />
        </Panel>
      )}

      <MemberSheet id={memberId} onClose={() => openMember(null)} />
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  )
}

function Chip({ children, active, onClick, accent }: { children: React.ReactNode; active: boolean; onClick: () => void; accent?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
        active ? 'border-transparent bg-fg text-bg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
      )}
    >
      {accent && !active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
      {children}
    </button>
  )
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'rose' }) {
  return (
    <div>
      <p className={cn('num text-[13px] font-semibold', tone === 'rose' && 'text-rose')}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-fg-faint">{label}</p>
    </div>
  )
}

/* ----------------------------- member sheet ---------------------------- */

function MemberSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, me, updateUser } = useApp()
  const { openTask, askAssistant } = useUI()
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  const user = state.users.find((u) => u.id === id)
  const stats = useMemo(
    () => (user ? statsFor(user.id, state.tasks, state.initiatives) : null),
    [user, state.tasks, state.initiatives],
  )

  if (!me) return null

  const isMe = user?.id === me.id
  const mayEdit = isMe || can(me, 'team.manage')

  return (
    <Drawer open={!!user} onClose={onClose} label="Member profile" width="sm:w-[560px]">
      {user && stats && (
        <>
          <header className="relative shrink-0 overflow-hidden border-b border-line px-5 pb-5 pt-5">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-20 blur-3xl"
              style={{ background: `radial-gradient(circle, ${user.accent}, transparent 70%)` }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <Avatar user={user} size="xl" ring />
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold leading-tight">{user.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] text-fg-muted">
                    <RoleTag role={user.role} />
                    {user.title}
                  </p>
                  <p className="num mt-1 flex items-center gap-1.5 text-[11px] text-fg-faint">
                    <CalendarDays size={11} /> Joined {fmtFullDate(user.joinedAt)}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X size={16} />
              </Button>
            </div>

            <div className="relative mt-5 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => askAssistant(`Tell me about ${user.name.split(' ')[0]}'s work ethic`)}>
                <Sparkles size={13} /> Ask the assistant
              </Button>
              {mayEdit && (
                <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
                  {editing ? 'Done editing' : 'Edit profile'}
                </Button>
              )}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <AnimatePresence mode="wait">
              {editing && mayEdit ? (
                <motion.div key="edit" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                  <Input label="Name" defaultValue={user.name} onBlur={(e) => updateUser(user.id, { name: e.target.value })} />
                  <Input label="Title" defaultValue={user.title} onBlur={(e) => updateUser(user.id, { title: e.target.value })} />
                  <Textarea label="Bio" defaultValue={user.bio} rows={3} onBlur={(e) => updateUser(user.id, { bio: e.target.value })} />
                  <Input
                    label="Skills"
                    hint="comma separated"
                    defaultValue={user.skills.join(', ')}
                    onBlur={(e) => updateUser(user.id, { skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  />
                  {can(me, 'team.manage') && (
                    <>
                      <Select
                        label="Role"
                        defaultValue={user.role}
                        onChange={(e) => {
                          updateUser(user.id, { role: e.target.value as Role })
                          toast({ tone: 'success', title: `${user.name.split(' ')[0]} is now ${ROLES[e.target.value as Role].label}` })
                        }}
                      >
                        {ROLE_LIST.map((r) => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </Select>
                      {user.id !== me.id && (
                        <Button
                          variant={user.active ? 'danger' : 'secondary'}
                          size="sm"
                          onClick={() => {
                            updateUser(user.id, { active: !user.active })
                            toast({ tone: 'info', title: user.active ? 'Member deactivated' : 'Member reactivated' })
                          }}
                        >
                          {user.active ? 'Deactivate account' : 'Reactivate account'}
                        </Button>
                      )}
                    </>
                  )}
                  <p className="text-[11px] text-fg-faint">Changes save as you leave each field.</p>
                </motion.div>
              ) : (
                <motion.div key="view" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                  {/* Work ethic */}
                  <section>
                    <SectionTitle hint="Punctuality, sign-off ratings, throughput and initiative">Work ethic</SectionTitle>
                    <div className="flex flex-col items-center gap-5 rounded-2xl border border-line bg-panel-2 p-5 sm:flex-row sm:items-start">
                      <RadialScore value={stats.reliability} label={`${user.name} reliability`} />
                      <p className="flex-1 text-[13px] leading-relaxed text-fg-muted">{ethicSummary(user, stats)}</p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Metric label="On time" value={stats.approved ? `${Math.round(stats.onTimeRate * 100)}%` : '—'} />
                      <Metric label="Avg rating" value={stats.ratedCount ? `${stats.avgRating.toFixed(1)}★` : '—'} />
                      <Metric label="Turnaround" value={stats.avgTurnaround ? fmtDuration(stats.avgTurnaround) : '—'} />
                      <Metric label="Streak" value={String(stats.streak)} />
                    </div>
                  </section>

                  {/* Points */}
                  <section>
                    <SectionTitle>Contribution</SectionTitle>
                    <div className="rounded-2xl border border-line bg-panel-2 p-5">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="num font-display text-3xl font-semibold leading-none">
                            <CountUp value={stats.points} />
                          </p>
                          <p className="mt-1 text-[11px] text-fg-faint">lifetime points</p>
                        </div>
                        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-fg">
                          {levelFor(stats.points).name}
                        </span>
                      </div>
                      <div className="mt-4">
                        <Progress
                          value={
                            levelFor(stats.points).next
                              ? ((stats.points - levelFor(stats.points).min) /
                                  (levelFor(stats.points).next! - levelFor(stats.points).min)) * 100
                              : 100
                          }
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
                        <Metric label="From tasks" value={String(stats.taskPoints)} bare />
                        <Metric label="From initiative" value={String(stats.initiativePoints)} bare />
                        <Metric label="Open now" value={String(stats.active)} bare />
                      </div>
                    </div>
                  </section>

                  {/* Access */}
                  <section>
                    <SectionTitle hint={ROLES[user.role].blurb}>
                      <span className="inline-flex items-center gap-1.5">
                        <Shield size={13} /> Access as {ROLES[user.role].label}
                      </span>
                    </SectionTitle>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {Object.keys(CAP_LABELS).map((cap) => {
                        const allowed = ROLE_CAPS[user.role].includes(cap as never)
                        return (
                          <div
                            key={cap}
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px]',
                              allowed ? 'bg-panel-2 text-fg-muted' : 'text-fg-faint line-through decoration-line-strong',
                            )}
                          >
                            {allowed ? <Check size={12} className="shrink-0 text-accent-fg" /> : <X size={12} className="shrink-0" />}
                            {CAP_LABELS[cap]}
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  {user.skills.length > 0 && (
                    <section>
                      <SectionTitle>Skills</SectionTitle>
                      <div className="flex flex-wrap gap-1.5">
                        {user.skills.map((s) => (
                          <span key={s} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-fg-muted">{s}</span>
                        ))}
                      </div>
                    </section>
                  )}

                  {user.bio && (
                    <section>
                      <SectionTitle>About</SectionTitle>
                      <p className="text-[13px] leading-relaxed text-fg-muted">{user.bio}</p>
                      <p className="num mt-3 flex items-center gap-1.5 text-[11px] text-fg-faint">
                        <Mail size={11} /> {user.email}
                      </p>
                    </section>
                  )}

                  <section>
                    <SectionTitle hint="Most recent first">Current work</SectionTitle>
                    {(() => {
                      const list = state.tasks
                        .filter((t) => t.assigneeId === user.id)
                        .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || a.dueAt - b.dueAt)
                        .slice(0, 8)
                      if (!list.length) return <p className="text-[13px] text-fg-faint">Nothing assigned.</p>
                      return (
                        <ul className="space-y-1">
                          {list.map((t) => (
                            <li key={t.id}>
                              <button
                                onClick={() => { onClose(); openTask(t.id) }}
                                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-panel-2"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-medium">{t.title}</span>
                                  <span className="num block text-[11px] text-fg-faint">{t.code} · {t.points} pts</span>
                                </span>
                                <StatusPill status={t.status} />
                                <DueChip task={t} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )
                    })()}
                  </section>

                  <p className="border-t border-line pt-4 text-[11px] text-fg-faint">
                    Last activity {stats.lastActiveAt ? relTime(stats.lastActiveAt) : 'unknown'}.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </Drawer>
  )
}

function Metric({ label, value, bare }: { label: string; value: string; bare?: boolean }) {
  return (
    <div className={cn(!bare && 'rounded-xl border border-line bg-panel-2 px-3 py-2.5')}>
      <p className="num text-[14px] font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-fg-faint">{label}</p>
    </div>
  )
}

/* ------------------------------- invite -------------------------------- */

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addUser } = useApp()
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [password, setPassword] = useState('flow1234')
  const [error, setError] = useState<string>()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a member"
      subtitle="They sign in with this email and password, and see only what their role allows."
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !email.trim()}
            onClick={() => {
              const res = addUser({ name, email, password, role, title })
              if (!res.ok) return setError(res.error)
              toast({ tone: 'success', title: `${name.split(' ')[0]} added as ${ROLES[role].label}` })
              setName(''); setEmail(''); setTitle(''); setError(undefined)
              onClose()
            }}
          >
            Add member
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Okonkwo" autoFocus />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jamie@flowmedia.studio" error={error} />
        <Input label="Job title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Motion Designer" />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} hint={ROLES[role].blurb}>
          {ROLE_LIST.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </Select>
        <Input label="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} hint="they can change it later" />
      </div>
    </Modal>
  )
}
