import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { FileUp, ImagePlus, Loader2 } from 'lucide-react'
import { MAX_FILE_BYTES, ingest } from '@/lib/media'
import { fmtBytes } from '@/lib/format'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/components/ui/cn'
import type { Attachment } from '@/types'

export function Dropzone({
  ownerId,
  onAdd,
  accept = 'image/*,video/*,audio/*,.pdf,.zip,.aep,.prproj',
  label = 'Drop images, video or files',
  hint = 'or click to browse — up to 220 MB each',
  compact,
}: {
  ownerId: string
  onAdd: (items: Attachment[]) => void
  accept?: string
  label?: string
  hint?: string
  compact?: boolean
}) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(0)

  const handle = async (files: FileList | null) => {
    if (!files?.length) return
    const list = Array.from(files)
    const tooBig = list.filter((f) => f.size > MAX_FILE_BYTES)
    const usable = list.filter((f) => f.size <= MAX_FILE_BYTES)
    if (tooBig.length) {
      toast({
        tone: 'error',
        title: `${tooBig.length} file${tooBig.length === 1 ? '' : 's'} skipped`,
        body: `Over the ${fmtBytes(MAX_FILE_BYTES)} limit: ${tooBig.map((f) => f.name).join(', ')}`,
      })
    }
    if (!usable.length) return

    setBusy(usable.length)
    const done: Attachment[] = []
    for (const file of usable) {
      try {
        done.push(await ingest(file, ownerId))
      } catch {
        toast({ tone: 'error', title: `Could not attach ${file.name}` })
      } finally {
        setBusy((n) => n - 1)
      }
    }
    if (done.length) onAdd(done)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        void handle(e.dataTransfer.files)
      }}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') input.current?.click()
      }}
      className={cn(
        'relative flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed text-center transition-all duration-200',
        compact ? 'h-14 px-4' : 'flex-col px-6 py-7',
        over ? 'border-accent bg-accent/6 scale-[1.005]' : 'border-line bg-panel-2 hover:border-line-strong hover:bg-panel-3',
      )}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files)
          e.target.value = ''
        }}
      />
      {busy > 0 ? (
        <span className="inline-flex items-center gap-2 text-[13px] text-fg-muted">
          <Loader2 size={15} className="animate-spin" />
          Processing {busy} file{busy === 1 ? '' : 's'}…
        </span>
      ) : (
        <>
          <motion.span
            animate={over ? { y: -2, scale: 1.08 } : { y: 0, scale: 1 }}
            className={cn('grid place-items-center rounded-xl', compact ? 'h-8 w-8' : 'h-10 w-10', over ? 'bg-accent text-on-accent' : 'bg-panel-3 text-fg-faint')}
          >
            {compact ? <FileUp size={15} /> : <ImagePlus size={18} />}
          </motion.span>
          <span className={cn(compact && 'text-left')}>
            <span className="block text-[13px] font-medium">{over ? 'Release to attach' : label}</span>
            {!over && <span className="mt-0.5 block text-xs text-fg-faint">{hint}</span>}
          </span>
        </>
      )}
    </div>
  )
}
