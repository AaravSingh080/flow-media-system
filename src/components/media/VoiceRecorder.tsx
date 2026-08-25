import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Mic, Square, Trash2 } from 'lucide-react'
import { ingest } from '@/lib/media'
import { fmtClock } from '@/lib/format'
import { Button } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/components/ui/cn'
import type { Attachment } from '@/types'
import { VoiceNote } from './Waveform'

const MAX_MS = 5 * 60_000

/**
 * Records a voice brief straight in the browser. Peaks are sampled live
 * from an AnalyserNode and stored with the file, so the saved note keeps
 * the waveform that was drawn while recording.
 */
export function VoiceRecorder({
  ownerId,
  onRecorded,
  notes,
  onRemove,
}: {
  ownerId: string
  onRecorded: (att: Attachment) => void
  notes: Attachment[]
  onRemove: (id: string) => void
}) {
  const toast = useToast()
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [live, setLive] = useState<number[]>([])
  const [busy, setBusy] = useState(false)

  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const raf = useRef<number | undefined>(undefined)
  const timer = useRef<number | undefined>(undefined)
  const peaks = useRef<number[]>([])
  const startedAt = useRef(0)

  const teardown = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current)
    if (timer.current) window.clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    void audioCtx.current?.close().catch(() => {})
    stream.current = null
    audioCtx.current = null
    recorder.current = null
  }, [])

  useEffect(() => teardown, [teardown])

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ tone: 'error', title: 'Recording is not available', body: 'This browser does not expose a microphone API.' })
      return
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      stream.current = media

      const ctx = new AudioContext()
      audioCtx.current = ctx
      const source = ctx.createMediaStreamSource(media)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      const buffer = new Float32Array(analyser.fftSize)

      peaks.current = []
      let lastSample = 0
      const sample = () => {
        analyser.getFloatTimeDomainData(buffer)
        let peak = 0
        for (const v of buffer) {
          const a = Math.abs(v)
          if (a > peak) peak = a
        }
        const now = performance.now()
        // ~14 peaks a second keeps the stored array small but readable.
        if (now - lastSample > 70) {
          lastSample = now
          peaks.current.push(Math.min(1, peak * 2.2))
          setLive((l) => [...l.slice(-56), Math.min(1, peak * 2.6)])
        }
        raf.current = requestAnimationFrame(sample)
      }
      raf.current = requestAnimationFrame(sample)

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      rec.onstop = async () => {
        const duration = Date.now() - startedAt.current
        teardown()
        setRecording(false)
        setLive([])
        setElapsed(0)
        if (duration < 500) {
          toast({ tone: 'info', title: 'Too short to keep', body: 'Hold the record button for at least a second.' })
          return
        }
        setBusy(true)
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
          const att = await ingest(blob, ownerId, {
            peaks: normalise(peaks.current),
            durationMs: duration,
            name: `voice-brief-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.webm`,
          })
          onRecorded(att)
        } catch {
          toast({ tone: 'error', title: 'Could not save that recording' })
        } finally {
          setBusy(false)
        }
      }

      startedAt.current = Date.now()
      rec.start(200)
      recorder.current = rec
      setRecording(true)
      timer.current = window.setInterval(() => {
        const ms = Date.now() - startedAt.current
        setElapsed(ms)
        if (ms >= MAX_MS) rec.stop()
      }, 200)
    } catch {
      toast({
        tone: 'error',
        title: 'Microphone blocked',
        body: 'Allow microphone access in your browser to record a voice brief.',
      })
      teardown()
    }
  }

  const stop = () => recorder.current?.stop()

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border p-3 transition-colors',
          recording ? 'border-rose/40 bg-rose/6' : 'border-line border-dashed bg-panel-2',
        )}
      >
        <Button
          type="button"
          variant={recording ? 'danger' : 'secondary'}
          size="icon"
          onClick={recording ? stop : () => void start()}
          loading={busy}
          aria-label={recording ? 'Stop recording' : 'Record a voice brief'}
          className={cn('h-10 w-10 rounded-full', recording && 'bg-rose text-white hover:bg-rose')}
        >
          {recording ? <Square size={14} fill="currentColor" /> : <Mic size={16} />}
        </Button>

        {recording ? (
          <>
            <div className="flex h-9 flex-1 items-center gap-[3px] overflow-hidden">
              {live.length === 0 && <span className="text-xs text-fg-faint">Listening…</span>}
              {live.map((p, i) => (
                <motion.span
                  key={i}
                  initial={{ scaleY: 0.2, opacity: 0.4 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  className="w-[3px] shrink-0 rounded-full bg-rose"
                  style={{ height: `${Math.max(10, p * 100)}%` }}
                />
              ))}
            </div>
            <span className="num flex items-center gap-2 text-xs text-rose">
              <span className="animate-pulse-dot inline-block h-2 w-2 rounded-full bg-rose" />
              {fmtClock(elapsed)}
            </span>
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">Record a voice brief</p>
            <p className="text-xs text-fg-faint">
              Faster than typing it out. Up to five minutes; the waveform is saved with the note.
            </p>
          </div>
        )}
      </div>

      {notes.map((n) => (
        <div key={n.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <VoiceNote attachment={n} compact />
          </div>
          <Button variant="ghost" size="icon" onClick={() => onRemove(n.id)} aria-label="Remove voice note">
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
    </div>
  )
}

function normalise(values: number[]): number[] {
  if (!values.length) return []
  const target = 96
  const step = values.length / target
  const out: number[] = []
  for (let i = 0; i < target; i++) {
    const slice = values.slice(Math.floor(i * step), Math.max(Math.floor((i + 1) * step), Math.floor(i * step) + 1))
    out.push(slice.length ? Math.max(...slice) : 0)
  }
  const ceiling = Math.max(...out, 0.01)
  return out.map((v) => Number((v / ceiling).toFixed(3)))
}
