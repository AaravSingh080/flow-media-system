import { DAY, HOUR } from './format'
import { uid, pad } from './id'
import { digest } from './storage'
import type { ActivityEntry, AppState, Initiative, Priority, Task, TaskStatus, User } from '@/types'

/** Deterministic jitter — the demo workspace looks the same on every boot. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEMO_PASSWORD = 'flow1234'

interface SeedPerson {
  id: string
  name: string
  email: string
  role: User['role']
  title: string
  bio: string
  skills: string[]
  accent: string
  joinedDaysAgo: number
}

const PEOPLE: SeedPerson[] = [
  {
    id: 'u_aarav',
    name: 'Aarav Singh',
    email: 'aarav@flowmedia.studio',
    role: 'admin',
    title: 'Founder & Creative Director',
    bio: 'Runs the slate end to end. Writes the brief, protects the deadline, signs off the cut.',
    skills: ['Creative direction', 'Client strategy', 'Story editing'],
    accent: 'var(--c-accent)',
    joinedDaysAgo: 720,
  },
  {
    id: 'u_meera',
    name: 'Meera Kapoor',
    email: 'meera@flowmedia.studio',
    role: 'admin',
    title: 'Head of Operations',
    bio: 'Keeps the pipeline honest. Owns scheduling, scoring calibration and delivery QC.',
    skills: ['Production ops', 'Scheduling', 'Budgeting', 'QC'],
    accent: 'var(--c-cyan)',
    joinedDaysAgo: 540,
  },
  {
    id: 'u_devon',
    name: 'Devon Osei',
    email: 'devon@flowmedia.studio',
    role: 'editor',
    title: 'Senior Editor',
    bio: 'Long-form and brand films. Fast on turnarounds, brutal about pacing.',
    skills: ['Premiere', 'DaVinci', 'Sound design', 'Colour'],
    accent: 'var(--c-cyan)',
    joinedDaysAgo: 410,
  },
  {
    id: 'u_lina',
    name: 'Lina Fischer',
    email: 'lina@flowmedia.studio',
    role: 'designer',
    title: 'Graphic Designer',
    bio: 'Key art, thumbnails and the brand system everything else hangs off.',
    skills: ['Figma', 'Illustrator', 'Type', 'Motion graphics'],
    accent: 'var(--c-violet)',
    joinedDaysAgo: 300,
  },
  {
    id: 'u_tomas',
    name: 'Tomás Rivera',
    email: 'tomas@flowmedia.studio',
    role: 'videographer',
    title: 'Director of Photography',
    bio: 'Shoots and lights. Hands over organised, labelled, colour-managed rushes.',
    skills: ['Cinematography', 'Lighting', 'Gimbal', 'Data wrangling'],
    accent: 'var(--c-amber)',
    joinedDaysAgo: 265,
  },
  {
    id: 'u_priya',
    name: 'Priya Nair',
    email: 'priya@flowmedia.studio',
    role: 'writer',
    title: 'Lead Writer',
    bio: 'Scripts, VO and the captions nobody else wants to write. Never misses a date.',
    skills: ['Scriptwriting', 'Copy', 'Research', 'Interviewing'],
    accent: 'var(--c-rose)',
    joinedDaysAgo: 220,
  },
  {
    id: 'u_kwame',
    name: 'Kwame Boateng',
    email: 'kwame@flowmedia.studio',
    role: 'social',
    title: 'Social & Community Lead',
    bio: 'Owns the channels, the calendar and the numbers that come back.',
    skills: ['Channel strategy', 'Analytics', 'Community', 'Paid social'],
    accent: 'var(--c-emerald)',
    joinedDaysAgo: 180,
  },
  {
    id: 'u_sana',
    name: 'Sana Malik',
    email: 'sana@flowmedia.studio',
    role: 'member',
    title: 'Production Assistant',
    bio: 'Floats across shoots and edits. Learning fast, volunteers for everything.',
    skills: ['Assist', 'Logging', 'Scheduling', 'Subtitling'],
    accent: 'var(--c-slate)',
    joinedDaysAgo: 95,
  },
  {
    id: 'u_jordan',
    name: 'Jordan Wu',
    email: 'jordan@northbeam.co',
    role: 'client',
    title: 'Marketing Lead · Northbeam',
    bio: 'Client-side stakeholder on the Northbeam campaign. Read-only access.',
    skills: ['Brand', 'Approvals'],
    accent: 'var(--c-fg-faint)',
    joinedDaysAgo: 60,
  },
]

interface SeedTask {
  title: string
  brief: string
  assignee: string
  creator: string
  status: TaskStatus
  priority: Priority
  points: number
  tags: string[]
  startOffset: number
  dueOffset: number
  /** Hand-in offset in days relative to now; negative = already delivered. */
  submitOffset?: number
  rating?: number
  note?: string
  review?: string
  /** Marks the task as carrying a voice brief once demo media is hydrated. */
  voice?: boolean
  refs?: number
}

const TASKS: SeedTask[] = [
  {
    title: 'Northbeam launch film — final grade',
    brief:
      'Final colour pass on the 90-second launch film. Match the warm look from the teaser, lift the interview shots about a third of a stop, and keep the product blues from going purple. Deliver ProRes plus an H.264 review copy.',
    assignee: 'u_devon', creator: 'u_aarav', status: 'done', priority: 'urgent', points: 55,
    tags: ['northbeam', 'edit', 'colour'], startOffset: -21, dueOffset: -14, submitOffset: -15,
    rating: 5, voice: true, refs: 1,
    note: 'Graded and delivered. Rebuilt the node tree so the interview and product passes are separate — easy to tweak either without touching the other. ProRes 422 HQ plus a 1080p review copy are in the drop.',
    review: 'Exactly the look we pitched. The separated node tree saved us on the client tweak. Full points.',
  },
  {
    title: 'Key art system — Northbeam campaign',
    brief:
      'Build the key art system: one hero lockup, three social crops (1:1, 4:5, 9:16) and a title-card template the editors can drop straight into Premiere. Type is Bricolage, accent is the campaign lime.',
    assignee: 'u_lina', creator: 'u_aarav', status: 'done', priority: 'high', points: 40,
    tags: ['northbeam', 'design', 'brand'], startOffset: -24, dueOffset: -17, submitOffset: -18,
    rating: 5, refs: 2,
    note: 'System delivered as a Figma library with variants. Added a fourth crop (2:3) for print because the client asked mid-way — no extra time needed.',
    review: 'Above scope and still early. The Premiere template alone saves the edit team hours a week.',
  },
  {
    title: 'Interview day — 2 camera setup, Studio B',
    brief:
      'Four interviews back to back, 09:00–15:00. Two-camera setup, key plus practical background. Record dual-system audio and hand over labelled cards the same evening.',
    assignee: 'u_tomas', creator: 'u_meera', status: 'done', priority: 'high', points: 45,
    tags: ['northbeam', 'shoot'], startOffset: -30, dueOffset: -29, submitOffset: -29,
    rating: 4,
    note: 'All four in the can. Interview three had an HVAC hum — I moved to the far wall and re-shot the opening two answers, so that one runs slightly long.',
    review: 'Good catch on the hum. Cards were labelled properly, which is why the edit started same-day.',
  },
  {
    title: 'Launch script — v3 with client notes',
    brief:
      'Fold the client notes into v2. They want the founder story to open, the product demo trimmed by roughly fifteen seconds, and a harder call to action. Keep it under 90 seconds read aloud.',
    assignee: 'u_priya', creator: 'u_aarav', status: 'done', priority: 'high', points: 30,
    tags: ['northbeam', 'script'], startOffset: -27, dueOffset: -24, submitOffset: -25,
    rating: 5, voice: true,
    note: 'v3 lands at 86 seconds read at pace. Founder story opens, demo is down to 22 seconds, and the CTA is now a single line instead of three.',
    review: 'Cleanest draft we have had from a note round. Timed read was spot on.',
  },
  {
    title: 'Thumbnail set — 6 variants for A/B',
    brief: 'Six thumbnail variants for the launch video, two per concept direction. Faces large, text under four words.',
    assignee: 'u_lina', creator: 'u_meera', status: 'done', priority: 'normal', points: 20,
    tags: ['design', 'social'], startOffset: -16, dueOffset: -12, submitOffset: -12,
    rating: 4, refs: 1,
    note: 'Six variants across three directions. My money is on the split-face concept — highest contrast at small sizes.',
    review: 'Solid set. Landed on the deadline rather than ahead of it, but the work is right.',
  },
  {
    title: 'Channel report — March performance',
    brief: 'Pull the March numbers across YouTube, Instagram and TikTok. Retention curves, top three and bottom three posts, and one recommendation per channel.',
    assignee: 'u_kwame', creator: 'u_meera', status: 'done', priority: 'normal', points: 25,
    tags: ['social', 'report'], startOffset: -14, dueOffset: -9, submitOffset: -8,
    rating: 3,
    note: 'Report is in. Headline: shorts retention is up 18% since we moved the hook to under two seconds. Recommendation is to cut every long-form intro to a single line.',
    review: 'The hook finding is actionable and well evidenced. A day late though, and the raw export is still missing.',
  },
  {
    title: 'Subtitle pass — launch film, EN + ES',
    brief: 'Burn-in-ready subtitle files for the launch film in English and Spanish. Two lines maximum, 42 characters per line.',
    assignee: 'u_sana', creator: 'u_meera', status: 'done', priority: 'normal', points: 15,
    tags: ['northbeam', 'post'], startOffset: -11, dueOffset: -7, submitOffset: -6,
    rating: 3,
    note: 'Both SRTs done and checked against the final cut. Spanish was reviewed by a native speaker before I sent it.',
    review: 'Careful work for a first solo pass, and getting the Spanish reviewed unprompted is the right instinct. It did land a day past the date — flag earlier next time.',
  },
  {
    title: 'Behind-the-scenes cut — 60s vertical',
    brief:
      'Cut a 60-second vertical BTS piece from the interview day rushes. Energetic, music-led, no VO. Needs to work muted, so caption the good lines.',
    assignee: 'u_devon', creator: 'u_aarav', status: 'in_review', priority: 'normal', points: 30,
    tags: ['social', 'edit'], startOffset: -6, dueOffset: -1, submitOffset: -1, refs: 1,
    note: 'First cut is up at 58 seconds. Captions on the three best lines. Music is a temp track — flag if we need to licence something before this goes out.',
  },
  {
    title: 'Northbeam case study — layout',
    brief: 'Design the case study page: hero still, three process sections, results block. Web and PDF export.',
    assignee: 'u_lina', creator: 'u_aarav', status: 'in_review', priority: 'normal', points: 35,
    tags: ['northbeam', 'design'], startOffset: -8, dueOffset: 1, submitOffset: 0,
    note: 'Layout is done in both formats. The results block reads better as a horizontal strip than the stacked version in the brief — both are in the file, take a look before I commit.',
  },
  {
    title: 'Q3 content calendar — first draft',
    brief:
      'Draft the Q3 calendar across all channels. Twelve weeks, three posts a week minimum, mapped to the two campaign beats we already know about. Flag anything that needs a shoot day.',
    assignee: 'u_kwame', creator: 'u_aarav', status: 'in_progress', priority: 'high', points: 35,
    tags: ['social', 'planning'], startOffset: -4, dueOffset: 3, voice: true,
  },
  {
    title: 'Product b-roll — 40 shot list',
    brief:
      'Shoot the product b-roll against the shot list. Macro on the textures, three lighting states per hero angle. Handheld is fine for the lifestyle block, locked off for anything we might key.',
    assignee: 'u_tomas', creator: 'u_meera', status: 'in_progress', priority: 'high', points: 45,
    tags: ['shoot', 'product'], startOffset: -2, dueOffset: 4, refs: 1,
  },
  {
    title: 'Website copy — services page rewrite',
    brief: 'Rewrite the services page. Cut it by about a third, lead with outcomes rather than deliverables, and keep the voice we set in the launch script.',
    assignee: 'u_priya', creator: 'u_aarav', status: 'in_progress', priority: 'normal', points: 25,
    tags: ['copy', 'website'], startOffset: -3, dueOffset: 5,
  },
  {
    title: 'Archive and label Q1 rushes',
    brief: 'Move all Q1 rushes to cold storage, label by shoot date and project, and leave a manifest in the shared drive.',
    assignee: 'u_sana', creator: 'u_meera', status: 'in_progress', priority: 'low', points: 10,
    tags: ['ops'], startOffset: -5, dueOffset: -1,
  },
  {
    title: 'Sizzle reel 2026 — assembly',
    brief:
      'Assemble the 2026 sizzle from the year’s best twelve projects. Ninety seconds, music-led, hard cuts on the beat. Pull the shots you want and flag anything you need regraded.',
    assignee: 'u_devon', creator: 'u_aarav', status: 'backlog', priority: 'high', points: 50,
    tags: ['reel', 'edit'], startOffset: 1, dueOffset: 9, voice: true,
  },
  {
    title: 'Brand refresh — motion identity',
    brief: 'Design the animated logo states: build-in, idle loop, and lower-third variant. After Effects source plus rendered alphas.',
    assignee: 'u_lina', creator: 'u_aarav', status: 'backlog', priority: 'normal', points: 40,
    tags: ['brand', 'motion'], startOffset: 2, dueOffset: 12,
  },
  {
    title: 'Podcast pilot — three episode outlines',
    brief: 'Outline three pilot episodes. Guest, hook, five beats and a closing question for each.',
    assignee: 'u_priya', creator: 'u_meera', status: 'backlog', priority: 'normal', points: 25,
    tags: ['podcast', 'script'], startOffset: 0, dueOffset: 7,
  },
  {
    title: 'Calibrate the points scale with the leads',
    brief:
      'Run the quarterly calibration on the points scale. Pull the last sixty approved tasks, check that light work still lands in the 10–20 band and that nothing heavy has crept above 60, and bring a proposal.',
    assignee: 'u_meera', creator: 'u_aarav', status: 'in_progress', priority: 'normal', points: 20,
    tags: ['ops', 'scoring'], startOffset: -1, dueOffset: 6,
  },
  {
    title: 'Client review deck — Northbeam wrap',
    brief: 'Build the wrap deck: what we shipped, what performed, what we would do differently. Twelve slides maximum.',
    assignee: 'u_aarav', creator: 'u_meera', status: 'in_progress', priority: 'high', points: 30,
    tags: ['northbeam', 'client'], startOffset: -2, dueOffset: 2,
  },
  {
    title: 'Studio lighting inventory + repairs',
    brief: 'Full inventory of the lighting kit. Flag anything broken, order replacements for the two dead ballasts.',
    assignee: 'u_tomas', creator: 'u_meera', status: 'backlog', priority: 'low', points: 10,
    tags: ['ops', 'kit'], startOffset: 3, dueOffset: 14,
  },
  {
    title: 'Shorts hook experiment — 8 variants',
    brief:
      'Cut eight opening hooks for the same short and schedule them across two weeks. We are testing whether a question hook beats a result hook. Log the retention delta.',
    assignee: 'u_kwame', creator: 'u_aarav', status: 'backlog', priority: 'normal', points: 30,
    tags: ['social', 'experiment'], startOffset: 1, dueOffset: 11,
  },
  {
    title: 'Onboard the new edit machine',
    brief: 'Set up the new workstation: software, plugins, colour-managed display profile, and hook it into the shared storage.',
    assignee: 'u_sana', creator: 'u_meera', status: 'backlog', priority: 'low', points: 12,
    tags: ['ops', 'kit'], startOffset: 2, dueOffset: 8,
  },
  {
    title: 'Northbeam cutdowns — 30s and 15s',
    brief:
      'Two cutdowns from the launch film for paid. Thirty and fifteen seconds, both with and without end cards. Keep the founder line in the 30 and drop it from the 15.',
    assignee: 'u_devon', creator: 'u_meera', status: 'backlog', priority: 'urgent', points: 35,
    tags: ['northbeam', 'edit', 'paid'], startOffset: 0, dueOffset: 3,
  },
  /* ---- Earlier work, so the record has depth beyond the current slate ---- */
  {
    title: 'Founder story — 3 minute cut',
    brief: 'Cut the founder interview into a standalone three-minute piece for the about page. Warm, unhurried, no music under the first thirty seconds.',
    assignee: 'u_devon', creator: 'u_aarav', status: 'done', priority: 'high', points: 50,
    tags: ['brand', 'edit'], startOffset: -44, dueOffset: -38, submitOffset: -39, rating: 5,
    note: 'Runs 2:54. Held the first thirty seconds dry as asked — it lands much harder without the bed under it.',
    review: 'The dry open was the right call. This is the piece we send when someone asks what we do.',
  },
  {
    title: 'Northbeam pitch deck — final round',
    brief: 'Take the deck through the final round: tighten to eighteen slides, rebuild the treatment section around the two directions they responded to, and cost it properly.',
    assignee: 'u_aarav', creator: 'u_meera', status: 'done', priority: 'urgent', points: 45,
    tags: ['northbeam', 'client', 'pitch'], startOffset: -40, dueOffset: -36, submitOffset: -37, rating: 5,
    note: 'Eighteen slides, two treatments, costed line by line. Cut the case study section entirely — they had already seen it.',
    review: 'Won the account. Dropping the case studies was the right instinct.',
  },
  {
    title: 'Rebuild the delivery QC checklist',
    brief: 'Our QC is in three different heads and none of them agree. Write one checklist that covers audio levels, colour space, caption timing, filenames and export settings.',
    assignee: 'u_meera', creator: 'u_aarav', status: 'done', priority: 'normal', points: 25,
    tags: ['ops', 'qc'], startOffset: -38, dueOffset: -34, submitOffset: -35, rating: 5,
    note: 'One page, twenty-two checks, grouped by who signs each off. Pinned in the shared drive and printed by the edit machines.',
    review: 'This should have existed two years ago. Zero delivery bounces since it went up.',
  },
  {
    title: 'Northbeam interview questions',
    brief: 'Write the interview questions for all four subjects. Open-ended, no yes/no traps, and give each subject one question the others do not get.',
    assignee: 'u_priya', creator: 'u_aarav', status: 'done', priority: 'normal', points: 20,
    tags: ['northbeam', 'script'], startOffset: -35, dueOffset: -32, submitOffset: -33, rating: 5,
    note: 'Twelve shared questions plus one unique per subject. Ordered so the easy ones warm them up before the personal one.',
    review: 'The warm-up ordering is why we got usable answers on the personal question. Noted for every shoot from here.',
  },
  {
    title: 'Q2 slate planning with the leads',
    brief: 'Run the Q2 planning session. Come out with a committed slate, an owner per project and the two shoot weeks blocked.',
    assignee: 'u_aarav', creator: 'u_meera', status: 'done', priority: 'normal', points: 30,
    tags: ['planning', 'ops'], startOffset: -33, dueOffset: -30, submitOffset: -30, rating: 4,
    note: 'Slate committed, owners assigned, both shoot weeks in the calendar. One project deferred to Q3 — we do not have the crew for it.',
    review: 'Good session. Deferring rather than over-committing was the right call, even if it was an uncomfortable one.',
  },
  {
    title: 'Log and label interview rushes',
    brief: 'Log all four interviews with timecoded selects, label the cards by subject and date, and flag anything with an audio problem.',
    assignee: 'u_sana', creator: 'u_meera', status: 'done', priority: 'normal', points: 12,
    tags: ['post', 'ops'], startOffset: -31, dueOffset: -28, submitOffset: -28, rating: 4,
    note: 'All four logged with timecoded selects. Flagged the HVAC hum on interview three so the edit does not waste time on those takes.',
    review: 'The hum flag saved the edit an afternoon. Thorough for a first pass at logging.',
  },
  {
    title: 'Social template refresh',
    brief: 'Refresh the social templates against the new brand system. Every format, every platform, and make the text layers actually editable this time.',
    assignee: 'u_lina', creator: 'u_meera', status: 'done', priority: 'normal', points: 30,
    tags: ['design', 'social', 'brand'], startOffset: -28, dueOffset: -22, submitOffset: -23, rating: 4,
    note: 'All nine formats rebuilt with proper text layers and auto-layout. Kwame can now edit copy without opening Figma properly.',
    review: 'Solid and on time. The editable text layers are the bit that actually changed how the social team works.',
  },
  {
    title: 'Product stills — 3 lighting setups',
    brief: 'Three lighting setups on the hero product: hard key, soft box, and the rim-lit look from the deck. Twelve frames per setup, tethered.',
    assignee: 'u_tomas', creator: 'u_aarav', status: 'done', priority: 'normal', points: 30,
    tags: ['shoot', 'product'], startOffset: -26, dueOffset: -21, submitOffset: -20, rating: 3,
    note: 'All three setups shot and tethered. The rim-lit look took longer than planned — the product finish threw a hotspot I had to flag out.',
    review: 'Frames are good and the hotspot fix was right. It ran a day past the date, though, and that pushed the retouch.',
  },
  {
    title: 'Vendor rates — renegotiate the kit hire',
    brief: 'Renegotiate the kit hire rates before the annual renewal. Get the weekly rate down or get the insurance bundled.',
    assignee: 'u_meera', creator: 'u_aarav', status: 'done', priority: 'normal', points: 35,
    tags: ['ops', 'budget'], startOffset: -20, dueOffset: -16, submitOffset: -17, rating: 5,
    note: 'Weekly rate down 14% and insurance is now bundled at no extra cost. Signed for twelve months.',
    review: 'Both asks landed. That pays for the new edit machine on its own.',
  },
  {
    title: 'Shorts hook test — round one',
    brief: 'Cut four opening hooks for the same short and schedule them across a week. Report the retention delta.',
    assignee: 'u_kwame', creator: 'u_aarav', status: 'done', priority: 'normal', points: 25,
    tags: ['social', 'experiment'], startOffset: -18, dueOffset: -14, submitOffset: -13, rating: 3,
    note: 'Four hooks out, data collected. Question hooks beat result hooks by 11% on three-second retention.',
    review: 'The finding is genuinely useful. Reporting slipped a day and I had to chase it, which is the only mark against it.',
  },

  /* ---- The last week, so the trend line and weekly figures are live ---- */
  {
    title: 'Northbeam social cutdowns — batch one',
    brief: 'Six vertical cutdowns from the launch film for the first paid burst. Captions burned in, each one able to stand alone without the others.',
    assignee: 'u_devon', creator: 'u_meera', status: 'done', priority: 'high', points: 30,
    tags: ['northbeam', 'social', 'edit'], startOffset: -9, dueOffset: -5, submitOffset: -6, rating: 5, refs: 1,
    note: 'Six cutdowns, captions burned in, each one standing on its own. Two of them work better than the master, honestly.',
    review: 'Delivered early and the standalone test holds up. These are going straight into the paid burst.',
  },
  {
    title: 'Case study cover art',
    brief: 'Cover art for the Northbeam case study. Needs to work as a web hero and a LinkedIn card without a second crop.',
    assignee: 'u_lina', creator: 'u_aarav', status: 'done', priority: 'normal', points: 20,
    tags: ['design', 'northbeam'], startOffset: -7, dueOffset: -4, submitOffset: -4, rating: 4,
    note: 'One composition that holds at both ratios — the safe area is marked in the file so nothing important sits in the crop.',
    review: 'Clean solve. Marking the safe area saves the next person from guessing.',
  },
  {
    title: 'Podcast pilot — episode one script',
    brief: 'Full script for pilot episode one from the outline. Cold open, five beats, and a closing question that sets up episode two.',
    assignee: 'u_priya', creator: 'u_aarav', status: 'done', priority: 'high', points: 28,
    tags: ['podcast', 'script'], startOffset: -8, dueOffset: -3, submitOffset: -3, rating: 5, voice: true,
    note: 'Full script, cold open included. The closing question hands straight into the episode two guest, so the two can be recorded back to back.',
    review: 'Reads out loud exactly as it reads on the page, which is rarer than it should be. Straight to record.',
  },
  {
    title: 'Community AMA — run it and write the recap',
    brief: 'Host the community AMA, then write the recap post with the three questions worth answering publicly.',
    assignee: 'u_kwame', creator: 'u_meera', status: 'done', priority: 'normal', points: 22,
    tags: ['social', 'community'], startOffset: -6, dueOffset: -2, submitOffset: -2, rating: 4,
    note: 'Ran 48 minutes, 140 live. Recap is up with the three best questions and a note on what we cannot answer yet.',
    review: 'Good turnout and an honest recap. Being straight about what we cannot answer buys more trust than dodging it.',
  },
]

interface SeedInitiative {
  title: string
  description: string
  by: string
  daysAgo: number
  status: Initiative['status']
  points?: number
  decidedBy?: string
  note?: string
  hours?: number
}

const INITIATIVES: SeedInitiative[] = [
  {
    title: 'Rebuilt the project template in Premiere',
    description:
      'Nobody asked for this, but every edit was starting from a blank slate. I built a shared project template with our bin structure, adjustment layers, colour-managed sequence presets and the title cards from Lina\'s system already loaded. Rolled it out to the three edit machines.',
    by: 'u_devon', daysAgo: 9, status: 'approved', points: 35, decidedBy: 'u_aarav', hours: 6,
    note: 'This saves every editor twenty minutes a project and removes a whole class of colour mistakes. Scored as a heavy task.',
  },
  {
    title: 'Subtitle style guide for the whole team',
    description:
      'After the EN/ES pass I wrote up what actually works: line lengths, timing rules, how we handle names and product terms, and a checklist to run before delivery. Three pages, with examples from our own films.',
    by: 'u_sana', daysAgo: 5, status: 'approved', points: 18, decidedBy: 'u_meera', hours: 4,
    note: 'Genuinely useful and well written. Scored mid-band — real value, contained scope.',
  },
  {
    title: 'Audited our stock music licences',
    description:
      'Found that four tracks we have used in published videos are on a licence that expired in February. I have listed the affected videos and found cleared replacements for each.',
    by: 'u_kwame', daysAgo: 2, status: 'pending', hours: 3,
  },
  {
    title: 'Lens and filter test chart for the studio',
    description:
      'Shot a full test of every lens we own at every stop, plus our three diffusion filters, on the same chart under the same light. Reference stills are on the drive so we can stop guessing which combination gives us the halation we like.',
    by: 'u_tomas', daysAgo: 1, status: 'pending', hours: 5,
  },
]

function activity(type: ActivityEntry['type'], actorId: string, at: number, message: string): ActivityEntry {
  return { id: uid('act'), type, actorId, at, message }
}

export function buildSeedState(now = Date.now()): AppState {
  const rand = mulberry32(20260825)
  const secret = digest(DEMO_PASSWORD)

  const users: User[] = PEOPLE.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    secret,
    role: p.role,
    title: p.title,
    bio: p.bio,
    skills: p.skills,
    accent: p.accent,
    joinedAt: now - p.joinedDaysAgo * DAY,
    active: true,
  }))

  const ordered = [...TASKS].sort((a, b) => a.startOffset - b.startOffset)
  const tasks: Task[] = ordered.map((t, i) => {
    const startAt = now + t.startOffset * DAY
    // A brief for work that starts next week was still written before now —
    // without this clamp the activity log reads "in 16 hours".
    const createdAt = Math.min(now - (2 + Math.floor(rand() * 5)) * HOUR, startAt - 6 * HOUR)
    const dueAt = now + t.dueOffset * DAY + 17 * HOUR
    const submittedAt = t.submitOffset !== undefined ? now + t.submitOffset * DAY + Math.floor(rand() * 6) * HOUR : undefined
    const approvedAt = t.status === 'done' && submittedAt ? submittedAt + (4 + Math.floor(rand() * 20)) * HOUR : undefined
    const approvedBy = approvedAt ? (t.creator === 'u_aarav' ? 'u_aarav' : 'u_meera') : undefined

    const log: ActivityEntry[] = [
      activity('created', t.creator, createdAt, 'opened the brief'),
      activity('assigned', t.creator, createdAt + 60_000, `assigned this to ${PEOPLE.find((p) => p.id === t.assignee)?.name ?? 'a member'}`),
      activity('points', t.creator, createdAt + 90_000, `set the value at ${t.points} points`),
    ]
    if (t.status !== 'backlog') log.push(activity('status', t.assignee, startAt + 2 * HOUR, 'moved this to In progress'))
    if (submittedAt) log.push(activity('submitted', t.assignee, submittedAt, 'submitted work for review'))
    if (approvedAt && approvedBy) log.push(activity('approved', approvedBy, approvedAt, `approved and released ${t.points} points`))

    return {
      id: `t_${pad(i + 1)}`,
      code: `FLW-${pad(i + 1)}`,
      title: t.title,
      brief: t.brief,
      attachments: [],
      createdBy: t.creator,
      assigneeId: t.assignee,
      watchers: t.tags.includes('northbeam') ? ['u_jordan'] : [],
      status: t.status,
      priority: t.priority,
      points: t.points,
      pointsAwarded: approvedAt ? t.points : undefined,
      startAt,
      dueAt,
      createdAt,
      updatedAt: approvedAt ?? submittedAt ?? startAt,
      submittedAt,
      approvedAt,
      approvedBy,
      tags: t.tags,
      deliverables: [],
      completionNote: t.note ?? '',
      reviewNote: t.review,
      reviewRating: t.rating,
      comments: [],
      activity: log,
      // Consumed by hydrateDemoMedia(), then irrelevant.
      ...(t.voice || t.refs ? { _demoMedia: { voice: !!t.voice, refs: t.refs ?? 0 } } : {}),
    } as Task
  })

  const initiatives: Initiative[] = INITIATIVES.map((s, i) => {
    const createdAt = now - s.daysAgo * DAY
    return {
      id: `i_${pad(i + 1)}`,
      code: `IN-${pad(i + 1)}`,
      title: s.title,
      description: s.description,
      attachments: [],
      proposedBy: s.by,
      createdAt,
      status: s.status,
      points: s.points,
      decidedBy: s.decidedBy,
      decidedAt: s.status === 'pending' ? undefined : createdAt + 20 * HOUR,
      decisionNote: s.note,
      effortHours: s.hours,
    }
  })

  return {
    version: 1,
    users,
    tasks,
    initiatives,
    notifications: [],
    session: null,
    prefs: {},
    counters: { task: tasks.length, initiative: initiatives.length },
  }
}
