import { useState } from 'react'
import { motion } from 'motion/react'
import { Download, FileText, Film, Play, Trash2 } from 'lucide-react'
import { fmtBytes, fmtClock } from '@/lib/format'
import { downloadAttachment } from '@/lib/media'
import { cn } from '@/components/ui/cn'
import type { Attachment } from '@/types'
import { useObjectUrl } from './useObjectUrl'
import { Lightbox } from './Lightbox'
import { VoiceNote } from './Waveform'

function Thumb({ att, onOpen, onRemove }: { att: Attachment; onOpen: () => void; onRemove?: () => void }) {
  const url = useObjectUrl(att.kind === 'image' ? att.blobId : undefined)
  const preview = att.kind === 'image' ? url : att.poster

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="group/att relative aspect-4/3 overflow-hidden rounded-xl border border-line bg-panel-2"
    >
      <button onClick={onOpen} className="absolute inset-0 h-full w-full" aria-label={`Open ${att.name}`}>
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover/att:scale-105" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-fg-faint">
            {att.kind === 'video' ? <Film size={20} /> : <FileText size={20} />}
            <span className="max-w-[85%] truncate px-2 text-[10px]">{att.name}</span>
          </span>
        )}
      </button>

      {att.kind === 'video' && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-bg-deep/65 text-white backdrop-blur-sm transition-transform duration-200 group-hover/att:scale-110">
            <Play size={14} fill="currentColor" className="ml-0.5" />
          </span>
        </span>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <span className="num truncate text-[10px] text-white/85">
          {att.durationMs ? fmtClock(att.durationMs) : fmtBytes(att.size)}
        </span>
      </div>

      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover/att:opacity-100">
        <button
          onClick={() => void downloadAttachment(att)}
          className="grid h-7 w-7 place-items-center rounded-lg bg-bg-deep/70 text-white backdrop-blur-sm hover:bg-bg-deep"
          aria-label="Download"
        >
          <Download size={12} />
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="grid h-7 w-7 place-items-center rounded-lg bg-bg-deep/70 text-white backdrop-blur-sm hover:bg-rose"
            aria-label="Remove"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export function AttachmentGrid({
  items,
  onRemove,
  className,
  columns = 'grid-cols-2 sm:grid-cols-3',
}: {
  items: Attachment[]
  onRemove?: (id: string) => void
  className?: string
  columns?: string
}) {
  const [open, setOpen] = useState<number | null>(null)
  if (!items.length) return null

  const audio = items.filter((a) => a.kind === 'audio')
  const visual = items.filter((a) => a.kind !== 'audio')

  return (
    <div className={cn('space-y-3', className)}>
      {audio.map((a) => (
        <div key={a.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <VoiceNote attachment={a} compact />
          </div>
          {onRemove && (
            <button onClick={() => onRemove(a.id)} className="text-fg-faint transition-colors hover:text-rose" aria-label="Remove">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      {visual.length > 0 && (
        <div className={cn('grid gap-2.5', columns)}>
          {visual.map((a, i) => (
            <Thumb key={a.id} att={a} onOpen={() => setOpen(i)} onRemove={onRemove ? () => onRemove(a.id) : undefined} />
          ))}
        </div>
      )}

      <Lightbox items={visual} index={open} onClose={() => setOpen(null)} />
    </div>
  )
}
