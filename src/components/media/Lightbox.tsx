import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { downloadAttachment } from '@/lib/media'
import { fmtBytes } from '@/lib/format'
import { Button } from '@/components/ui/primitives'
import { useObjectUrl } from './useObjectUrl'
import type { Attachment } from '@/types'

export function Lightbox({
  items,
  index,
  onClose,
}: {
  items: Attachment[]
  index: number | null
  onClose: () => void
}) {
  const [current, setCurrent] = useState(index ?? 0)

  useEffect(() => {
    if (index !== null) setCurrent(index)
  }, [index])

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setCurrent((c) => (c + 1) % items.length)
      if (e.key === 'ArrowLeft') setCurrent((c) => (c - 1 + items.length) % items.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, items.length, onClose])

  const att = items[current]
  const url = useObjectUrl(att?.blobId)

  return (
    <AnimatePresence>
      {index !== null && att && (
        <motion.div
          className="fixed inset-0 z-200 flex flex-col bg-bg-deep/94 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <header className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{att.name}</p>
              <p className="num text-xs text-fg-faint">
                {fmtBytes(att.size)} · {current + 1} of {items.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => void downloadAttachment(att)} aria-label="Download">
                <Download size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X size={16} />
              </Button>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6" onClick={onClose}>
            <AnimatePresence mode="wait">
              <motion.div
                key={att.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="max-h-full max-w-5xl"
                onClick={(e) => e.stopPropagation()}
              >
                {att.kind === 'image' && url && (
                  <img src={url} alt={att.name} className="max-h-[76vh] rounded-xl object-contain shadow-lift" />
                )}
                {att.kind === 'video' && url && (
                  <video src={url} controls autoPlay className="max-h-[76vh] rounded-xl shadow-lift" />
                )}
                {att.kind === 'audio' && url && <audio src={url} controls autoPlay className="w-[420px] max-w-full" />}
                {att.kind === 'file' && (
                  <div className="panel px-10 py-14 text-center">
                    <p className="text-sm font-medium">{att.name}</p>
                    <p className="mt-1 text-xs text-fg-faint">No inline preview for this format.</p>
                    <Button className="mt-5" onClick={() => void downloadAttachment(att)}>
                      <Download size={14} /> Download
                    </Button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {items.length > 1 && (
              <>
                <NavButton side="left" onClick={() => setCurrent((c) => (c - 1 + items.length) % items.length)} />
                <NavButton side="right" onClick={() => setCurrent((c) => (c + 1) % items.length)} />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      className={`absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-panel/80 text-fg backdrop-blur transition-transform hover:scale-105 ${
        side === 'left' ? 'left-5' : 'right-5'
      }`}
    >
      {side === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  )
}
