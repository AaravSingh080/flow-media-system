import { ingest, putBlob } from './media'
import { uid } from './id'
import type { Attachment, Task } from '@/types'

/* ------------------------------------------------------------------ *
 * Demo media
 *
 * The seeded workspace ships with a couple of real voice briefs and
 * reference frames so the media features are exercised on first run
 * rather than sitting empty until someone uploads something. Everything
 * here is generated in the browser — no assets are bundled.
 * ------------------------------------------------------------------ */

const PALETTES: [string, string, string][] = [
  ['#0d1b2a', '#2a6f97', '#ccff3d'],
  ['#1b1024', '#7c3aed', '#f0abfc'],
  ['#241503', '#d97706', '#fde68a'],
  ['#04211c', '#059669', '#a7f3d0'],
]

/** A procedural "reference frame" — a plausible mood board still. */
function referenceFrame(index: number, label: string): Promise<Blob> {
  const [bg, mid, accent] = PALETTES[index % PALETTES.length]
  const w = 1280
  const h = 720
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, bg)
  grad.addColorStop(0.6, mid)
  grad.addColorStop(1, bg)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Soft light pools.
  for (let i = 0; i < 5; i++) {
    const r = 140 + i * 70
    const radial = ctx.createRadialGradient(w * (0.2 + i * 0.17), h * (0.3 + (i % 2) * 0.35), 0, w * (0.2 + i * 0.17), h * (0.3 + (i % 2) * 0.35), r)
    radial.addColorStop(0, `${accent}33`)
    radial.addColorStop(1, 'transparent')
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, w, h)
  }

  // Framing marks — reads as a camera reference rather than wallpaper.
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 2
  ctx.strokeRect(w / 12, h / 12, w - w / 6, h - h / 6)
  ctx.beginPath()
  for (let i = 1; i < 3; i++) {
    ctx.moveTo((w / 3) * i, h / 12)
    ctx.lineTo((w / 3) * i, h - h / 12)
    ctx.moveTo(w / 12, (h / 3) * i)
    ctx.lineTo(w - w / 12, (h / 3) * i)
  }
  ctx.stroke()

  ctx.fillStyle = accent
  ctx.font = '600 30px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(label.toUpperCase(), w / 12 + 22, h - h / 12 - 26)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '400 20px ui-monospace, monospace'
  ctx.fillText('REF · 1280×720 · FLOW', w / 12 + 22, h / 12 + 38)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

export function peaksFrom(samples: Float32Array, buckets = 96): number[] {
  const size = Math.max(1, Math.floor(samples.length / buckets))
  const peaks: number[] = []
  for (let i = 0; i < buckets; i++) {
    let max = 0
    const start = i * size
    for (let j = start; j < start + size && j < samples.length; j++) {
      const v = Math.abs(samples[j])
      if (v > max) max = v
    }
    peaks.push(Math.min(1, max))
  }
  const ceiling = Math.max(...peaks, 0.001)
  return peaks.map((p) => Number((p / ceiling).toFixed(3)))
}

/**
 * A stand-in voice memo. Amplitude follows a speech-like cadence of
 * phrases and pauses so the waveform in the player looks like a person
 * talking rather than a test tone.
 */
function voiceMemo(seconds: number, seed: number): { blob: Blob; peaks: number[]; durationMs: number } {
  const rate = 16000
  const n = Math.floor(rate * seconds)
  const samples = new Float32Array(n)
  let phase = 0
  let rng = seed

  const next = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff
    return rng / 0x7fffffff
  }

  // Build phrase windows: bursts of speech separated by short breaths.
  const windows: [number, number][] = []
  let cursor = 0.15
  while (cursor < seconds - 0.2) {
    const len = 0.5 + next() * 1.5
    windows.push([cursor, Math.min(seconds - 0.1, cursor + len)])
    cursor += len + 0.14 + next() * 0.35
  }

  for (let i = 0; i < n; i++) {
    const t = i / rate
    const win = windows.find(([a, b]) => t >= a && t <= b)
    if (!win) {
      samples[i] = (next() - 0.5) * 0.002
      continue
    }
    const [a, b] = win
    const local = (t - a) / (b - a)
    const envelope = Math.sin(Math.PI * local) ** 0.7
    const f0 = 108 + Math.sin(t * 2.3 + seed) * 16 + Math.sin(local * Math.PI * 3) * 9
    phase += (2 * Math.PI * f0) / rate
    const harmonics =
      Math.sin(phase) * 0.6 +
      Math.sin(phase * 2) * 0.22 +
      Math.sin(phase * 3) * 0.12 +
      Math.sin(phase * 5) * 0.05
    const breath = (next() - 0.5) * 0.09
    samples[i] = (harmonics + breath) * envelope * 0.42
  }

  return { blob: encodeWav(samples, rate), peaks: peaksFrom(samples), durationMs: Math.round(seconds * 1000) }
}

async function makeVoiceAttachment(uploadedBy: string, seconds: number, seed: number, name: string): Promise<Attachment> {
  const { blob, peaks, durationMs } = voiceMemo(seconds, seed)
  const blobId = await putBlob(blob, uid('blob'))
  return {
    id: uid('att'),
    kind: 'audio',
    name,
    mime: 'audio/wav',
    size: blob.size,
    blobId,
    peaks,
    durationMs,
    uploadedBy,
    createdAt: Date.now(),
  }
}

interface DemoFlags { voice: boolean; refs: number }

/**
 * Reads the transient `_demoMedia` markers left by the seed builder,
 * generates the matching media, and returns tasks with it attached.
 */
export async function hydrateDemoMedia(tasks: Task[]): Promise<Task[]> {
  let seed = 7
  let refIndex = 0
  const out: Task[] = []

  for (const task of tasks) {
    const flags = (task as Task & { _demoMedia?: DemoFlags })._demoMedia
    if (!flags) {
      out.push(task)
      continue
    }
    const attachments: Attachment[] = []

    if (flags.voice) {
      seed += 137
      attachments.push(
        await makeVoiceAttachment(task.createdBy, 7 + (seed % 5), seed, `brief-note-${task.code.toLowerCase()}.wav`),
      )
    }
    for (let i = 0; i < flags.refs; i++) {
      const label = task.tags[0] ?? 'reference'
      const blob = await referenceFrame(refIndex++, `${label} ref ${i + 1}`)
      attachments.push(await ingest(blob, task.createdBy, { name: `${task.code.toLowerCase()}-ref-${i + 1}.png` }))
    }

    const clean = { ...task, attachments } as Task & { _demoMedia?: DemoFlags }
    delete clean._demoMedia
    out.push(clean)
  }
  return out
}
