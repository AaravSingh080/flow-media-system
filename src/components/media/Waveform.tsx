import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { fmtClock } from '@/lib/format'
import { cn } from '@/components/ui/cn'
import { useObjectUrl } from './useObjectUrl'
import type { Attachment } from '@/types'

/** Fallback shape when a recording arrived without a stored peak array. */
function fallbackPeaks(seed: string, n = 72): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    const env = Math.sin((i / n) * Math.PI) ** 0.6
    return 0.25 + (h / 0x7fffffff) * 0.75 * env
  })
}

export function VoiceNote({ attachment, compact }: { attachment: Attachment; compact?: boolean }) {
  const url = useObjectUrl(attachment.blobId)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState((attachment.durationMs ?? 0) / 1000)

  const peaks = attachment.peaks?.length ? attachment.peaks : fallbackPeaks(attachment.id)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration)
    }
    const onEnd = () => {
      setPlaying(false)
      setProgress(0)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [url])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * audio.duration
    setProgress(ratio)
  }

  const elapsed = duration * progress

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3',
        compact ? 'h-12' : 'h-14',
      )}
    >
      {url && <audio ref={audioRef} src={url} preload="metadata" />}
      <button
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className={cn(
          'grid shrink-0 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-40',
          compact ? 'h-8 w-8' : 'h-9 w-9',
          'bg-accent text-on-accent',
        )}
      >
        {playing ? <Pause size={compact ? 13 : 15} fill="currentColor" /> : <Play size={compact ? 13 : 15} fill="currentColor" className="ml-0.5" />}
      </button>

      <div className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-[2px]" onClick={seek} role="slider" aria-label="Seek" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} tabIndex={0}>
        {peaks.map((p, i) => {
          const played = i / peaks.length <= progress
          return (
            <span
              key={i}
              className="min-w-[2px] flex-1 rounded-full transition-colors duration-100"
              style={{
                height: `${Math.max(12, p * (compact ? 60 : 74))}%`,
                background: played ? 'var(--c-accent)' : 'var(--c-line-strong)',
              }}
            />
          )
        })}
      </div>

      <span className="num shrink-0 text-[11px] text-fg-faint">
        {fmtClock(elapsed * 1000)} / {fmtClock(duration * 1000)}
      </span>
    </div>
  )
}
