# Flow · Media System

A role-aware task and contribution system for creative teams. Briefs go out as
text, voice, images, video — or any combination. Work comes back as the actual
file. Points are attached when the work is briefed and released when an admin
signs it off.

Everything runs in the browser: no server, no API keys, no network calls.

```bash
npm install
npm run dev      # http://localhost:5173
```

Sign in with any demo account listed on the login screen. The password is
`flow1234`. Start as **Aarav Singh (Admin)** to see the whole system, then use
Settings → *Switch role for a look* to see how much narrower it gets for a
contributor.

## What it does

**Briefs in whatever form the instruction takes.** A brief can be a written
paragraph, a recorded voice note, reference frames, footage, or all of them at
once — the composer accepts any combination and rejects only an empty one.
Voice notes are recorded in-browser via `MediaRecorder`, with the waveform
sampled live from an `AnalyserNode` and stored alongside the audio so the saved
note keeps the shape it was drawn with.

**Assignment and timeline.** Any active member can be assigned, admins
included. Every task carries a start date, a due date, a priority and a point
value.

**Hand-in.** The assignee attaches the final product and writes up what they
did. If there is nothing to hand over, the write-up on its own is enough.

**Sign-off releases the points.** Points are never credited at hand-in. An
admin reviews, rates the delivery, adjusts the value if the work turned out
heavier or lighter than briefed, and releases. **Nobody can approve their own
submission** — that rule holds for admins too.

**Initiatives** cover work nobody assigned. Describe what you did, attach the
proof, and an admin decides what it was worth.

**The scoreboard** ranks by released points and is recomputed from the task
record on every render, so it cannot drift. Alongside it sits a reliability
score per member — punctuality 40%, sign-off ratings 25%, throughput 20%,
initiative 15%, with live overdue work penalised.

**Notifications land, they don't just accumulate.** When work is assigned to
you, four things can happen and each is switchable in Settings: a card slides
in over whatever you're doing and clears itself after a few seconds, a short
synthesised chime plays (new work, approvals and send-backs use different
intervals, so you can tell them apart without looking), an OS notification
fires if the tab is in the background, and the unread count appears in the tab
title. Because the workspace is shared between tabs in one browser, a second
tab picks up a new assignment live, with no refresh.

**The assistant** answers from the same data every dashboard reads. Ask what is
overdue, who has capacity, how many tasks somebody has completed, or what a
person's delivery habits look like. It is a local intent engine, not a language
model — deterministic, offline, and incapable of contradicting the board. When
it cannot match a question it falls back to keyword search rather than
inventing an answer.

## Roles

Eight roles resolve through one capability matrix in `src/lib/permissions.ts`.
Adding a role means adding a row there; nothing else in the app hard-codes a
role name to decide what somebody may do.

| Role | Brief work | Assign | Set points | Approve | Analytics |
|---|---|---|---|---|---|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Editor | ✓ | ✓ | — | — | ✓ |
| Social Manager | — | — | — | — | ✓ |
| Designer · Videographer · Writer · Member | — | — | — | — | — |
| Client | read-only, and only work they watch | | | | |

Every role can log initiatives and browse the team, except Client. What a role
cannot do, it cannot see — gated nav items are absent, not disabled.

## Also in here

- **Board, list and timeline** views of the same work. The timeline is a
  compressed Gantt grouped by assignee, with a live today marker.
- **Drag and drop** between board columns — except into Done, which requires
  the sign-off flow because it moves points.
- **⌘K command palette** over tasks, people and views, with any unmatched query
  handed to the assistant.
- **Notifications** on assignment, hand-in, sign-off, comments and deadlines
  crossing into the last 24 hours — with an inbox that sorts unread first.
- **Per-task threads** with text, voice and file replies.
- **Light and dark themes**, plus an in-app reduce-motion switch that layers on
  top of the OS setting.
- **Export / import** the workspace as JSON.

## How data is stored

| What | Where | Why |
|---|---|---|
| Tasks, people, points, sessions | `localStorage` | Survives a refresh; small and structured |
| Voice notes, images, video | `IndexedDB` | `localStorage` holds ~5 MB of strings, nowhere near a rough cut |

On first run the app seeds a demo studio and generates its media in the
browser — procedural reference frames on a canvas, and synthetic voice notes
whose amplitude follows a speech-like cadence of phrases and pauses. No assets
are bundled.

Object URLs are cached per blob key and revoked on teardown, so repeatedly
rendering the same attachment does not leak.

## Not production-ready as-is

This is a complete front end with a browser-local persistence layer standing in
for a backend. Before real use:

- **Authentication is not real.** Passwords are obscured by a non-cryptographic
  digest so they are not sitting in plain text in devtools. That is all it is.
  Authenticate server-side.
- **Permissions are enforced in the client only.** The capability matrix is the
  right shape to port, but a real deployment has to enforce it on the server too.
- **Data is per-browser.** Nothing syncs between people or devices. The
  scoreboard is real for one browser's copy of the workspace.
- **Switch role for a look** is a demo convenience and would not exist behind a
  real backend.

## Layout

```
src/
├─ lib/
│  ├─ permissions.ts   roles, capabilities, visibility rules
│  ├─ analytics.ts     stats, reliability, leaderboards — all derived, never stored
│  ├─ assistant.ts     the local intent engine
│  ├─ media.ts         IndexedDB blob store, object-URL cache, upload pipeline
│  ├─ notify.ts        alert channels: chime, desktop, cross-tab delivery
│  ├─ seed.ts          the demo studio
│  └─ demoMedia.ts     procedural reference frames and synthetic voice notes
├─ store/              app state + persistence, UI navigation state
├─ components/
│  ├─ ui/              buttons, fields, modals, toasts, avatars
│  ├─ media/           recorder, waveform player, dropzone, lightbox
│  ├─ charts/          hand-rolled SVG — single-measure, single-hue, with hover
│  ├─ task/            cards, status and priority marks
│  └─ layout/          shell, sidebar, topbar, command palette
└─ views/              one file per tab
```

### A note on the date fields

Chromium draws the `datetime-local` calendar button as a fixed near-black icon.
It stays black on a dark field even under `color-scheme: dark`, and the element
ignores `filter` — `display` is one of the few properties it honours. So the
native button is removed and `DateTimeField` draws its own, which is themeable
and behaves the same everywhere. The input itself is still a real
`datetime-local`, so typing and the OS picker both work.

### A note on the charts

Every chart plots one measure, so each uses one hue and needs no legend. Two
measures of different scale are never put on one pair of axes — where both
matter, the second rides in the tooltip. The categorical palette was checked
with a CVD validator rather than by eye, which is how the light-mode accent
ended up a deep olive (`#557000`): the bright lime used in dark mode reaches
only 1.68:1 on white and fails both as a chart mark and as a button fill.

## Scripts

| | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck, then production build |
| `npm run typecheck` | types only |
| `npm run preview` | serve the build |

Stack: React 19, Vite 8, Tailwind 4, Motion, TypeScript. No UI kit — the
components are all in this repo.
