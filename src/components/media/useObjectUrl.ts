import { useEffect, useState } from 'react'
import { blobUrl } from '@/lib/media'

/** Resolves an IndexedDB blob key to a cached object URL. */
export function useObjectUrl(blobId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let alive = true
    if (!blobId) {
      setUrl(undefined)
      return
    }
    void blobUrl(blobId).then((u) => {
      if (alive) setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [blobId])
  return url
}
