import { DAY, fmtDate, plural, startOfDay } from './format'
import { ROLES, ROLE_CAPS, can, visibleTasks } from './permissions'
import { ethicSummary, leaderboard, levelFor, pointsByTag, pulse, statsFor } from './analytics'
import type { AppState, AssistantCard, Task, User } from '@/types'

/* ------------------------------------------------------------------ *
 * Flow Assistant
 *
 * A local, deterministic answer engine over the workspace. No network
 * call, no API key — every answer is derived from the same data the
 * dashboards read, so the assistant can never contradict the board.
 *
 * Matching is intentionally shallow: score intents on keyword and
 * pattern hits, extract the entities the winning intent needs, then run
 * a hand-written responder. That is far more predictable for a fixed
 * domain than anything fuzzier, and it degrades into keyword search
 * rather than into confident nonsense.
 * ------------------------------------------------------------------ */

export interface AssistantReply {
  text: string
  cards?: AssistantCard[]
  suggestions?: string[]
}

interface Ctx {
  state: AppState
  me: User
  tasks: Task[]
  query: string
  words: string[]
  people: User[]
  taskRefs: Task[]
  now: number
}

const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'of', 'to', 'in', 'on', 'for',
  'and', 'or', 'me', 'my', 'i', 'we', 'our', 'you', 'your', 'what', 'whats', 'how', 'who', 'when',
  'show', 'tell', 'give', 'about', 'any', 'have', 'has', 'can', 'please', 'with', 'that', 'this',
])

function normalise(q: string): string {
  return q.toLowerCase().replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(q: string): string[] {
  return normalise(q).split(' ').filter((w) => w && !STOP.has(w))
}

/* ---------------------------- entities ---------------------------- */

function matchPeople(query: string, users: User[]): User[] {
  const q = normalise(query)
  const hits: { user: User; weight: number }[] = []
  for (const u of users) {
    const full = u.name.toLowerCase()
    const first = full.split(' ')[0]
    const last = full.split(' ').slice(-1)[0]
    if (q.includes(full)) hits.push({ user: u, weight: 3 })
    else if (new RegExp(`\\b${first}\\b`).test(q)) hits.push({ user: u, weight: 2 })
    else if (last.length > 3 && new RegExp(`\\b${last}\\b`).test(q)) hits.push({ user: u, weight: 2 })
    else if (q.includes(u.email.split('@')[0])) hits.push({ user: u, weight: 2 })
  }
  return hits.sort((a, b) => b.weight - a.weight).map((h) => h.user)
}

function matchTasks(query: string, tasks: Task[]): Task[] {
  const codes = normalise(query).match(/\b(?:flw|in)[\s-]?(\d{1,4})\b/g) ?? []
  const byCode = codes
    .map((c) => c.replace(/[\s-]/g, ''))
    .map((c) => tasks.find((t) => t.code.toLowerCase().replace('-', '') === c))
    .filter((t): t is Task => !!t)
  if (byCode.length) return byCode

  const words = tokenize(query).filter((w) => w.length > 3)
  if (!words.length) return []
  return tasks
    .map((t) => {
      const hay = `${t.title} ${t.tags.join(' ')}`.toLowerCase()
      const score = words.reduce((s, w) => s + (hay.includes(w) ? (t.title.toLowerCase().includes(w) ? 2 : 1) : 0), 0)
      return { t, score }
    })
    .filter((r) => r.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.t)
}

function timeframe(q: string, now: number): { label: string; until: number } | null {
  const s = normalise(q)
  const today = startOfDay(now)
  if (/\btoday\b/.test(s)) return { label: 'today', until: today + DAY }
  if (/\btomorrow\b/.test(s)) return { label: 'tomorrow', until: today + 2 * DAY }
  if (/\bthis week\b|\bweek\b/.test(s)) return { label: 'this week', until: today + 7 * DAY }
  if (/\bthis month\b|\bmonth\b/.test(s)) return { label: 'this month', until: today + 30 * DAY }
  if (/\bnext (\d+) days?\b/.test(s)) {
    const n = Number(RegExp.$1)
    return { label: `the next ${plural(n, 'day')}`, until: today + n * DAY }
  }
  return null
}

/* ---------------------------- helpers ----------------------------- */

const nameOf = (state: AppState, id: string) => state.users.find((u) => u.id === id)?.name ?? 'someone'

function listCard(label: string, tasks: Task[], limit = 6): AssistantCard {
  return { type: 'tasks', label, ids: tasks.slice(0, limit).map((t) => t.id) }
}

/* ---------------------------- intents ----------------------------- */

interface Intent {
  id: string
  /** Weighted keyword hits. */
  keys: [RegExp, number][]
  /** Bonus if the query mentions a person / a task. */
  wantsPerson?: number
  wantsTask?: number
  run: (ctx: Ctx) => AssistantReply
}

const INTENTS: Intent[] = [
  {
    id: 'help',
    keys: [[/\bhelp\b|\bwhat can you (do|answer)\b|\bcommands?\b|\bhow do you work\b/, 6]],
    run: ({ me }) => ({
      text:
        `I answer from this workspace's live data — tasks, deadlines, points and how each person works. Things worth asking me:\n\n` +
        `• "What's on my plate?" or "What's overdue?"\n` +
        `• "How many tasks has Devon completed?"\n` +
        `• "Tell me about Priya's work ethic"\n` +
        `• "Who has the most points?" / "Who has capacity?"\n` +
        `• "What's due this week?"\n` +
        `• "How do points work?"\n` +
        `• "What can a graphic designer do?"\n\n` +
        `You're signed in as ${me.name} (${ROLES[me.role].label}), so I'll only show you work you have access to.`,
      suggestions: ["What's overdue?", 'Who has the most points?', 'How do points work?'],
    }),
  },

  {
    id: 'myWork',
    keys: [
      [/\bmy (tasks?|work|plate|queue|assignments?)\b/, 6],
      [/\bwhat (am i|should i) (working on|doing|do)\b/, 6],
      [/\bassigned to me\b|\bon my plate\b/, 6],
      [/\bam i (behind|late|on track)\b/, 4],
    ],
    run: ({ tasks, me, now, state }) => {
      const mine = tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done')
      if (!mine.length) {
        return {
          text: `You have nothing open right now, ${me.name.split(' ')[0]}. Clean slate.`,
          suggestions: ['What needs review?', 'Who has capacity?'],
        }
      }
      const sorted = [...mine].sort((a, b) => a.dueAt - b.dueAt)
      const late = sorted.filter((t) => t.dueAt < now)
      const pts = sorted.reduce((s, t) => s + t.points, 0)
      const head = `You have ${plural(sorted.length, 'open task')} worth ${pts} points in total.`
      const warn = late.length ? ` ${plural(late.length, 'is', 'are')} already past due — ${late.map((t) => t.code).join(', ')}.` : ''
      const next = ` Next up: ${sorted[0].title}, due ${fmtDate(sorted[0].dueAt)}.`
      return {
        text: head + warn + next,
        cards: [listCard('Your open work', sorted), {
          type: 'stat',
          items: [
            { label: 'Open', value: String(sorted.length) },
            { label: 'Overdue', value: String(late.length), tone: late.length ? 'rose' : undefined },
            { label: 'Points in flight', value: String(pts) },
            { label: 'Lifetime points', value: String(statsFor(me.id, state.tasks, state.initiatives, now).points) },
          ],
        }],
        suggestions: ['What is due this week?', 'How do points work?'],
      }
    },
  },

  {
    id: 'overdue',
    keys: [
      [/\boverdue\b|\bpast due\b|\blate\b|\bslipping\b|\bbehind schedule\b|\bmissed deadline/, 7],
      [/\bwhat.s (blocked|at risk)\b/, 4],
    ],
    run: ({ tasks, now, state, me }) => {
      const late = tasks
        .filter((t) => t.status !== 'done' && t.dueAt < now)
        .sort((a, b) => a.dueAt - b.dueAt)
      if (!late.length) {
        return { text: 'Nothing is overdue. Every open task is still inside its window.', suggestions: ['What is due this week?'] }
      }
      const byPerson = new Map<string, number>()
      for (const t of late) byPerson.set(t.assigneeId, (byPerson.get(t.assigneeId) ?? 0) + 1)
      const worst = [...byPerson.entries()].sort((a, b) => b[1] - a[1])[0]
      const mine = late.filter((t) => t.assigneeId === me.id).length
      return {
        text:
          `${plural(late.length, 'task is', 'tasks are')} past due. The oldest is ${late[0].code} — ${late[0].title}, which was due ${fmtDate(late[0].dueAt)} and sits with ${nameOf(state, late[0].assigneeId)}.` +
          (worst[1] > 1 ? ` ${nameOf(state, worst[0])} is carrying ${worst[1]} of them.` : '') +
          (mine ? ` ${plural(mine, 'is')} yours.` : ''),
        cards: [listCard('Overdue', late, 8)],
        suggestions: ['Who has capacity?', 'What needs review?'],
      }
    },
  },

  {
    id: 'dueSoon',
    keys: [
      [/\bdue\b/, 5],
      [/\bdeadline|\bupcoming\b|\bthis week\b|\btoday\b|\btomorrow\b|\bcoming up\b/, 4],
      [/\btimeline\b|\bschedule\b/, 2],
    ],
    run: ({ tasks, query, now, state }) => {
      const frame = timeframe(query, now) ?? { label: 'the next 7 days', until: startOfDay(now) + 7 * DAY }
      const soon = tasks
        .filter((t) => t.status !== 'done' && t.dueAt >= now && t.dueAt < frame.until)
        .sort((a, b) => a.dueAt - b.dueAt)
      if (!soon.length) {
        return { text: `Nothing falls due ${frame.label}.`, suggestions: ["What's overdue?", 'Show me the backlog'] }
      }
      const pts = soon.reduce((s, t) => s + t.points, 0)
      return {
        text:
          `${plural(soon.length, 'task lands', 'tasks land')} ${frame.label}, worth ${pts} points between them. First up is ${soon[0].code} — ${soon[0].title} (${nameOf(state, soon[0].assigneeId)}, ${fmtDate(soon[0].dueAt)}).`,
        cards: [listCard(`Due ${frame.label}`, soon, 8)],
        suggestions: ["What's overdue?", 'Who has capacity?'],
      }
    },
  },

  {
    id: 'ethic',
    keys: [
      [/\bwork ethic\b|\bethic\b|\breliab|\bdependab|\btrustworthy\b/, 8],
      [/\btell me about\b|\bwho is\b|\bprofile\b|\bhow (does|is) \w+ (work|doing|perform)/, 5],
      [/\bhabits?\b|\bon.?time\b|\bpunctual/, 5],
    ],
    wantsPerson: 4,
    run: ({ people, state, now, me }) => {
      const target = people[0]
      if (!target) {
        // No name given — profile the whole team instead of guessing.
        const board = leaderboard(state, now)
        const best = board.filter((s) => s.approved > 0).sort((a, b) => b.reliability - a.reliability)[0]
        return {
          text: best
            ? `Name someone and I'll break down how they work. Right now the strongest habits on the team belong to ${nameOf(state, best.userId)} — ${best.reliability}/100 reliability, ${Math.round(best.onTimeRate * 100)}% on time across ${plural(best.approved, 'approved task')}.`
            : 'Name a member and I will break down their delivery habits.',
          cards: best ? [{ type: 'ethic', userId: best.userId }] : undefined,
          suggestions: state.users.slice(1, 4).map((u) => `Tell me about ${u.name.split(' ')[0]}'s work ethic`),
        }
      }
      const s = statsFor(target.id, state.tasks, state.initiatives, now)
      const level = levelFor(s.points)
      const isMe = target.id === me.id
      const opener = isMe ? "Here's how your own record reads." : ''
      return {
        text: `${opener}${opener ? ' ' : ''}${ethicSummary(target, s)}`,
        cards: [
          { type: 'ethic', userId: target.id },
          {
            type: 'stat',
            items: [
              { label: 'Points', value: String(s.points) },
              { label: 'Level', value: level.name },
              { label: 'Approved', value: String(s.approved) },
              { label: 'Open now', value: String(s.active), tone: s.overdue ? 'rose' : undefined },
            ],
          },
        ],
        suggestions: [`What is ${target.name.split(' ')[0]} working on?`, 'Who has the most points?'],
      }
    },
  },

  {
    id: 'memberWork',
    keys: [
      [/\bworking on\b|\bassigned to\b|\bwhat.s \w+ (doing|got|on)\b|\bqueue\b|\bplate\b/, 6],
      [/\bhow many (tasks?|jobs?)\b|\bcompleted\b|\bfinished\b|\bdelivered\b|\bdone\b/, 5],
      [/\bpoints?\b|\bscore\b/, 3],
    ],
    wantsPerson: 5,
    run: ({ people, state, tasks, now, query }) => {
      const target = people[0]
      if (!target) return INTENTS.find((i) => i.id === 'board')!.run({ people, state, tasks, now, query } as Ctx)

      const s = statsFor(target.id, state.tasks, state.initiatives, now)
      const asksCompleted = /\bcomplet|finish|deliver|done\b/.test(query.toLowerCase())
      const open = tasks
        .filter((t) => t.assigneeId === target.id && t.status !== 'done')
        .sort((a, b) => a.dueAt - b.dueAt)
      const doneList = tasks
        .filter((t) => t.assigneeId === target.id && t.status === 'done')
        .sort((a, b) => (b.approvedAt ?? 0) - (a.approvedAt ?? 0))

      if (asksCompleted) {
        return {
          text:
            `${target.name} has ${plural(s.approved, 'approved task')} to their name, worth ${s.taskPoints} points` +
            (s.initiativesApproved
              ? `, plus ${plural(s.initiativesApproved, 'approved initiative')} adding another ${s.initiativePoints} — ${s.points} points in total.`
              : `.`) +
            ` ${Math.round(s.onTimeRate * 100)}% of it landed on or before the deadline.`,
          cards: [
            listCard(`${target.name.split(' ')[0]}'s recent deliveries`, doneList, 5),
            {
              type: 'stat',
              items: [
                { label: 'Approved', value: String(s.approved) },
                { label: 'Points', value: String(s.points) },
                { label: 'On time', value: `${Math.round(s.onTimeRate * 100)}%` },
                { label: 'Avg rating', value: s.ratedCount ? s.avgRating.toFixed(1) : '—' },
              ],
            },
          ],
          suggestions: [`Tell me about ${target.name.split(' ')[0]}'s work ethic`, 'Who has the most points?'],
        }
      }

      if (!open.length) {
        return {
          text: `${target.name} has nothing open — everything assigned to them is signed off. Lifetime total is ${s.points} points across ${plural(s.approved, 'approved task')}.`,
          cards: [{ type: 'ethic', userId: target.id }],
          suggestions: ['Who has capacity?'],
        }
      }
      return {
        text:
          `${target.name} has ${plural(open.length, 'task')} open, worth ${open.reduce((a, t) => a + t.points, 0)} points. ` +
          `Nearest deadline is ${open[0].title} on ${fmtDate(open[0].dueAt)}${open[0].dueAt < now ? ' — already past due' : ''}.`,
        cards: [listCard(`${target.name.split(' ')[0]}'s open work`, open)],
        suggestions: [`How many tasks has ${target.name.split(' ')[0]} completed?`, `Tell me about ${target.name.split(' ')[0]}'s work ethic`],
      }
    },
  },

  {
    id: 'board',
    keys: [
      [/\bleaderboard\b|\bstanding|\branking?s?\b|\bmost points\b|\btop (performer|member|scorer)\b/, 8],
      [/\bwho.s (winning|ahead|top|best)\b/, 7],
      [/\bpoints\b/, 2],
    ],
    run: ({ state, now }) => {
      const board = leaderboard(state, now).filter((s) => s.points > 0)
      if (!board.length) {
        return { text: 'No points have been released yet — the scoreboard starts once an admin approves a delivery.' }
      }
      const [first, second] = board
      const gap = second ? first.points - second.points : 0
      return {
        text:
          `${nameOf(state, first.userId)} leads with ${first.points} points from ${plural(first.approved, 'approved task')}` +
          (second ? `, ${gap} ahead of ${nameOf(state, second.userId)} on ${second.points}.` : '.') +
          ` Total released across the team: ${board.reduce((s, r) => s + r.points, 0)} points.`,
        cards: [
          {
            type: 'scoreboard',
            label: 'Points standing',
            unit: 'pts',
            rows: board.slice(0, 8).map((s) => ({
              userId: s.userId,
              value: s.points,
              sub: `${s.approved} approved · ${Math.round(s.onTimeRate * 100)}% on time`,
            })),
          },
        ],
        suggestions: ['How do points work?', 'Who has capacity?'],
      }
    },
  },

  {
    id: 'capacity',
    keys: [
      [/\bcapacity\b|\bwho.s free\b|\bavailable\b|\bbandwidth\b|\blightest\b|\bleast busy\b/, 8],
      [/\bwho should i assign\b|\bwho can take\b|\bworkload\b|\bbusiest\b/, 7],
    ],
    run: ({ state, now, query }) => {
      const board = leaderboard(state, now)
      const wantsBusiest = /\bbusiest\b|\bmost loaded\b|\boverloaded\b/.test(query.toLowerCase())
      const ranked = [...board].sort((a, b) => (wantsBusiest ? b.workload - a.workload : a.workload - b.workload))
      const pick = ranked[0]
      return {
        text: wantsBusiest
          ? `${nameOf(state, pick.userId)} is carrying the most: ${plural(pick.active, 'open task')}${pick.overdue ? `, ${pick.overdue} of them overdue` : ''}.`
          : `${nameOf(state, pick.userId)} has the lightest load right now — ${plural(pick.active, 'open task')}${pick.overdue ? ` (${pick.overdue} overdue, worth checking before you pile on)` : ''}. Their reliability sits at ${pick.reliability}/100.`,
        cards: [
          {
            type: 'scoreboard',
            label: wantsBusiest ? 'Heaviest load first' : 'Lightest load first',
            unit: 'open',
            rows: ranked.slice(0, 8).map((s) => ({
              userId: s.userId,
              value: s.active,
              sub: `${s.overdue} overdue · ${s.reliability}/100 reliability`,
            })),
          },
        ],
        suggestions: ["What's overdue?", 'Who has the most points?'],
      }
    },
  },

  {
    id: 'review',
    keys: [
      [/\bneeds? (review|approval|sign.?off)\b|\bawaiting\b|\bpending approval\b|\bto approve\b/, 8],
      [/\bin review\b|\bsubmitted\b/, 6],
    ],
    run: ({ tasks, state, now, me }) => {
      const waiting = tasks.filter((t) => t.status === 'in_review').sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0))
      const initiatives = state.initiatives.filter((i) => i.status === 'pending')
      if (!waiting.length && !initiatives.length) {
        return { text: 'Nothing is waiting on a sign-off. The review queue is empty.' }
      }
      const canApprove = can(me, 'task.approve')
      const parts: string[] = []
      if (waiting.length) {
        parts.push(
          `${plural(waiting.length, 'delivery is', 'deliveries are')} waiting on review — the oldest is ${waiting[0].code} from ${nameOf(state, waiting[0].assigneeId)}, submitted ${fmtDate(waiting[0].submittedAt ?? now)}.`,
        )
      }
      if (initiatives.length) {
        parts.push(`${plural(initiatives.length, 'self-directed submission needs', 'self-directed submissions need')} a point value.`)
      }
      parts.push(canApprove ? 'You can sign these off.' : 'An admin needs to sign these off.')
      return {
        text: parts.join(' '),
        cards: waiting.length ? [listCard('Waiting on review', waiting, 6)] : undefined,
        suggestions: ['How do points work?', "What's overdue?"],
      }
    },
  },

  {
    id: 'points',
    keys: [
      [/\bhow (do|does) (the )?points? work\b|\bpoint (scale|system|value|band)\b|\bscoring\b/, 9],
      [/\bwhat.s a task worth\b|\bhow many points\b/, 5],
    ],
    wantsTask: 3,
    run: ({ taskRefs, state, now }) => {
      if (taskRefs.length) {
        const t = taskRefs[0]
        return {
          text:
            `${t.code} — ${t.title} — is set at ${t.points} points${t.pointsAwarded !== undefined ? ` and has already released ${t.pointsAwarded} to ${nameOf(state, t.assigneeId)}` : `, released to ${nameOf(state, t.assigneeId)} once an admin approves it`}.`,
          cards: [listCard('Task', [t])],
        }
      }
      const tags = pointsByTag(state.tasks).slice(0, 4)
      return {
        text:
          `Points are set by whoever briefs the task, and they scale with the weight of the work — light jobs sit around 10–20, a normal piece 25–40, and something heavy 45–60 or more. ` +
          `Points are not credited when the work is handed in; they are released when an admin approves it, and nobody can approve their own submission.\n\n` +
          `Work someone does off their own bat goes through Initiatives instead: you describe what you did, and an admin decides what it was worth.` +
          (tags.length ? `\n\nSo far the team has earned most from ${tags.map((t) => `${t.tag} (${t.points})`).join(', ')}.` : ''),
        cards: [
          {
            type: 'stat',
            items: [
              { label: 'Light', value: '10–20' },
              { label: 'Standard', value: '25–40' },
              { label: 'Heavy', value: '45–60+' },
              { label: 'Released', value: String(leaderboard(state, now).reduce((s, r) => s + r.points, 0)) },
            ],
          },
        ],
        suggestions: ['Who has the most points?', 'What needs review?'],
      }
    },
  },

  {
    id: 'roles',
    keys: [
      [/\brole\b|\bpermission|\baccess\b|\bwho can\b|\ballowed to\b|\bwhat can (an?|the) \w+ do\b/, 8],
      [/\badmin\b|\beditor\b|\bdesigner\b|\bvideographer\b|\bwriter\b/, 3],
    ],
    run: ({ query, state, me }) => {
      const roleKey = (Object.keys(ROLES) as (keyof typeof ROLES)[]).find((r) =>
        new RegExp(`\\b${r}\\b|\\b${ROLES[r].label.toLowerCase()}\\b`).test(normalise(query)),
      )
      if (!roleKey) {
        const counts = new Map<string, number>()
        for (const u of state.users) if (u.active) counts.set(u.role, (counts.get(u.role) ?? 0) + 1)
        return {
          text:
            `The workspace runs on ${counts.size} active roles: ` +
            [...counts.entries()].map(([r, n]) => `${n}× ${ROLES[r as keyof typeof ROLES].label}`).join(', ') +
            `. You're a ${ROLES[me.role].label}. Ask about a specific role and I'll tell you exactly what it may do.`,
          suggestions: ['What can an editor do?', 'What can a graphic designer do?'],
        }
      }
      const meta = ROLES[roleKey]
      const caps = ROLE_CAPS[roleKey]
      const holders = state.users.filter((u) => u.role === roleKey && u.active)
      const readable: Record<string, string> = {
        'task.create': 'open new briefs',
        'task.assign.any': 'assign work to anyone on the team',
        'task.setPoints': 'set the point value of a task',
        'task.approve': 'approve deliveries and release points',
        'task.editAny': 'edit any brief',
        'task.deleteAny': 'delete tasks',
        'task.viewAll': 'see the whole board',
        'initiative.create': 'submit self-directed work for scoring',
        'initiative.decide': 'score other people\'s self-directed work',
        'team.viewAll': 'browse member profiles',
        'team.manage': 'manage members and roles',
        'analytics.view': 'open the analytics view',
        'settings.manage': 'change workspace settings',
      }
      return {
        text:
          `${meta.label} — ${meta.blurb}\n\nThey can ${caps.map((c) => readable[c] ?? c).join(', ')}.` +
          (holders.length ? `\n\nCurrently held by ${holders.map((h) => h.name).join(', ')}.` : '\n\nNobody holds this role right now.'),
        cards: holders.length ? [{ type: 'members', label: `${meta.label}s`, ids: holders.map((h) => h.id) }] : undefined,
        suggestions: ['What can an admin do?', 'Who has the most points?'],
      }
    },
  },

  {
    id: 'initiatives',
    keys: [[/\binitiative|\bself.?directed\b|\bextra work\b|\bown work\b|\bproposal|\bside project/, 8]],
    run: ({ state }) => {
      const pending = state.initiatives.filter((i) => i.status === 'pending')
      const approved = state.initiatives.filter((i) => i.status === 'approved')
      const pts = approved.reduce((s, i) => s + (i.points ?? 0), 0)
      return {
        text:
          `Initiatives are for work nobody assigned — you describe what you did and an admin puts a value on it. ` +
          `${approved.length} have been scored so far, worth ${pts} points in total` +
          (pending.length ? `, and ${plural(pending.length, 'is', 'are')} still waiting on a decision.` : '.') +
          (pending.length ? ` The oldest is "${pending[pending.length - 1].title}" from ${nameOf(state, pending[pending.length - 1].proposedBy)}.` : ''),
        cards: [
          {
            type: 'stat',
            items: [
              { label: 'Scored', value: String(approved.length) },
              { label: 'Pending', value: String(pending.length), tone: pending.length ? 'amber' : undefined },
              { label: 'Points from initiative', value: String(pts) },
              { label: 'Avg award', value: approved.length ? String(Math.round(pts / approved.length)) : '—' },
            ],
          },
        ],
        suggestions: ['How do points work?', 'Who has the most points?'],
      }
    },
  },

  {
    id: 'pulse',
    keys: [
      [/\bhow are we doing\b|\bsummary\b|\bstatus\b|\bpulse\b|\boverview\b|\bstand.?up\b|\bbrief me\b|\bcatch me up\b/, 8],
      [/\bthis week\b/, 2],
    ],
    run: ({ state, now, me }) => {
      const p = pulse(state, now)
      const board = leaderboard(state, now)
      const top = board[0]
      return {
        text:
          `${plural(p.open, 'task is', 'tasks are')} open, ${p.inReview} waiting on sign-off and ${p.overdue} past due. ` +
          `The team closed ${plural(p.completedThisWeek, 'task')} in the last seven days, releasing ${p.pointsThisWeek} points — about ${p.throughput.toFixed(1)} a day. ` +
          (top ? `${nameOf(state, top.userId)} is top of the board on ${top.points}. ` : '') +
          (p.pendingInitiatives ? `${plural(p.pendingInitiatives, 'initiative needs', 'initiatives need')} scoring.` : 'No initiatives are waiting.'),
        cards: [
          {
            type: 'stat',
            items: [
              { label: 'Open', value: String(p.open) },
              { label: 'In review', value: String(p.inReview), tone: p.inReview ? 'amber' : undefined },
              { label: 'Overdue', value: String(p.overdue), tone: p.overdue ? 'rose' : undefined },
              { label: 'Due this week', value: String(p.dueThisWeek) },
            ],
          },
        ],
        suggestions: can(me, 'task.approve') ? ['What needs review?', "What's overdue?"] : ['What is on my plate?', "What's overdue?"],
      }
    },
  },

  {
    id: 'taskLookup',
    keys: [[/\bstatus of\b|\bwhere is\b|\bwhat happened to\b|\btask\b|\bbrief\b/, 3]],
    wantsTask: 7,
    run: ({ taskRefs, state, now }) => {
      if (!taskRefs.length) return { text: "I couldn't find a task matching that. Try the code, like FLW-004, or a few words from the title." }
      const t = taskRefs[0]
      const statusLabel = { backlog: 'in the backlog', in_progress: 'in progress', in_review: 'waiting on review', done: 'signed off' }[t.status]
      const extra =
        t.status === 'done'
          ? ` It was approved by ${nameOf(state, t.approvedBy ?? '')} and released ${t.pointsAwarded ?? t.points} points${t.reviewRating ? `, rated ${t.reviewRating}/5` : ''}.`
          : t.dueAt < now
            ? ` It is overdue by ${Math.ceil((now - t.dueAt) / DAY)} days.`
            : ` It is due ${fmtDate(t.dueAt)}.`
      return {
        text: `${t.code} — ${t.title} — is ${statusLabel} with ${nameOf(state, t.assigneeId)}, briefed by ${nameOf(state, t.createdBy)} at ${t.points} points.${extra}`,
        cards: [listCard('Task', taskRefs, 3)],
      }
    },
  },
]

/* ---------------------------- the engine -------------------------- */

export function ask(state: AppState, me: User, query: string, now = Date.now()): AssistantReply {
  const tasks = visibleTasks(me, state.tasks).filter((t) => !t.archived)
  const people = matchPeople(query, state.users)
  const taskRefs = matchTasks(query, tasks)
  const ctx: Ctx = { state, me, tasks, query, words: tokenize(query), people, taskRefs, now }

  let best: { intent: Intent; score: number } | null = null
  for (const intent of INTENTS) {
    let score = 0
    for (const [re, weight] of intent.keys) if (re.test(normalise(query))) score += weight
    if (score === 0) continue
    if (intent.wantsPerson && people.length) score += intent.wantsPerson
    if (intent.wantsTask && taskRefs.length) score += intent.wantsTask
    if (!best || score > best.score) best = { intent, score }
  }

  if (best && best.score >= 4) return best.intent.run(ctx)

  // A bare name is a request for that person.
  if (people.length && !best) return INTENTS.find((i) => i.id === 'ethic')!.run(ctx)
  // A bare task code is a lookup.
  if (taskRefs.length) return INTENTS.find((i) => i.id === 'taskLookup')!.run(ctx)
  if (best) return best.intent.run(ctx)

  // Fall back to keyword search rather than inventing an answer.
  const words = ctx.words.filter((w) => w.length > 2)
  if (words.length) {
    const hits = tasks
      .map((t) => {
        const hay = `${t.title} ${t.brief} ${t.tags.join(' ')}`.toLowerCase()
        return { t, score: words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0) }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.t)
    if (hits.length) {
      return {
        text: `I don't have a direct answer for that, but ${plural(hits.length, 'task mentions', 'tasks mention')} what you asked about:`,
        cards: [listCard('Closest matches', hits, 5)],
        suggestions: ['What can you help with?', "What's overdue?"],
      }
    }
  }

  return {
    text:
      `I couldn't match that to anything in the workspace. I'm good on tasks, deadlines, points, and how each person works — try "what's overdue?", "how many tasks has Devon completed?", or "tell me about Priya's work ethic".`,
    suggestions: ["What's overdue?", 'Who has the most points?', 'What can you help with?'],
  }
}

export const STARTER_PROMPTS = [
  "What's on my plate?",
  "What's overdue?",
  'Who has the most points?',
  'Who has capacity right now?',
  'How do points work?',
  'What needs review?',
]
