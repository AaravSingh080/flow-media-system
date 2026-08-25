import { uid } from './id'
import type { Attachment, AttachmentKind } from '@/types'

/* ------------------------------------------------------------------ *
 * Blob store
 *
 * localStorage tops out around 5 MB and only holds strings, which is
 * nowhere near enough for a 40 MB rough cut. Binary lives in IndexedDB;
 * the JSON state only carries the key.
 * ------------------------------------------------------------------ */

const DB_NAME = 'flow-media'
const DB_VERSION = 1
const STORE = 'blobs'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function putBlob(blob: Blob, key = uid('blob')): Promise<string> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return key
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as Blob | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteBlob(key: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function blobKeys(): Promise<string[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAllKeys()
    req.onsuccess = () => resolve(req.result as string[])
    req.onerror = () => reject(req.error)
  })
}

/* ------------------------------------------------------------------ *
 * Object URL cache
 *
 * Components ask for a URL by blobId many times over; minting a fresh
 * object URL each render leaks. One URL per key, revoked on teardown.
 * ------------------------------------------------------------------ */

const urlCache = new Map<string, string>()
const pending = new Map<string, Promise<string | undefined>>()

export async function blobUrl(key: string): Promise<string | undefined> {
  const hit = urlCache.get(key)
  if (hit) return hit
  const inflight = pending.get(key)
  if (inflight) return inflight

  const p = (async () => {
    const blob = await getBlob(key)
    if (!blob) return undefined
    const url = URL.createObjectURL(blob)
    urlCache.set(key, url)
    return url
  })()
  pending.set(key, p)
  try {
    return await p
  } finally {
    pending.delete(key)
  }
}

export function releaseAllUrls(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url)
  urlCache.clear()
}

/* ------------------------------------------------------------------ *
 * Upload helpers
 * ------------------------------------------------------------------ */

export const MAX_FILE_BYTES = 220 * 1024 * 1024

export function kindOf(mime: string, name = ''): AttachmentKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(ext)) return 'image'
  if (ext && ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return 'video'
  if (ext && ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio'
  return 'file'
}

/** Grab a frame from a video file so cards have something to show. */
export function videoPoster(file: Blob): Promise<{ poster?: string; durationMs?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let settled = false
    const finish = (result: { poster?: string; durationMs?: number }) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => finish({}), 6000)

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = url

    video.onloadeddata = () => {
      const durationMs = Number.isFinite(video.duration) ? video.duration * 1000 : undefined
      try {
        const scale = Math.min(1, 640 / (video.videoWidth || 640))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round((video.videoWidth || 640) * scale))
        canvas.height = Math.max(1, Math.round((video.videoHeight || 360) * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish({ durationMs })
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        clearTimeout(timer)
        finish({ poster: canvas.toDataURL('image/jpeg', 0.6), durationMs })
      } catch {
        clearTimeout(timer)
        finish({ durationMs })
      }
    }
    video.onerror = () => {
      clearTimeout(timer)
      finish({})
    }
    // Seek a little past the first frame — frame 0 is often black.
    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(0.6, (video.duration || 1) / 3)
      } catch {
        /* some containers refuse to seek; onloadeddata still fires */
      }
    }
  })
}

function audioDuration(file: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    const done = (ms?: number) => {
      URL.revokeObjectURL(url)
      resolve(ms)
    }
    const timer = setTimeout(() => done(undefined), 4000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      clearTimeout(timer)
      done(Number.isFinite(audio.duration) ? audio.duration * 1000 : undefined)
    }
    audio.onerror = () => {
      clearTimeout(timer)
      done(undefined)
    }
    audio.src = url
  })
}

export interface UploadExtras {
  peaks?: number[]
  durationMs?: number
  name?: string
}

/** Persist a file/blob and return the metadata record that references it. */
export async function ingest(file: File | Blob, uploadedBy: string, extras: UploadExtras = {}): Promise<Attachment> {
  const name = extras.name ?? (file instanceof File ? file.name : 'recording.webm')
  const mime = file.type || 'application/octet-stream'
  const kind = kindOf(mime, name)

  let poster: string | undefined
  let durationMs = extras.durationMs
  if (kind === 'video') {
    const meta = await videoPoster(file)
    poster = meta.poster
    durationMs = durationMs ?? meta.durationMs
  } else if (kind === 'audio' && durationMs === undefined) {
    durationMs = await audioDuration(file)
  }

  const blobId = await putBlob(file)
  return {
    id: uid('att'),
    kind,
    name,
    mime,
    size: file.size,
    blobId,
    poster,
    peaks: extras.peaks,
    durationMs,
    uploadedBy,
    createdAt: Date.now(),
  }
}

/** Trigger a browser download for a stored attachment. */
export async function downloadAttachment(att: Attachment): Promise<void> {
  const blob = await getBlob(att.blobId)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = att.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
