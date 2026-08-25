import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useApp } from './AppStore'

export type ViewId =
  | 'dashboard'
  | 'board'
  | 'scoreboard'
  | 'initiatives'
  | 'team'
  | 'analytics'
  | 'assistant'
  | 'settings'

interface UIState {
  view: ViewId
  go: (view: ViewId) => void
  /** Task open in the detail drawer, if any. */
  taskId: string | null
  openTask: (id: string | null) => void
  composeOpen: boolean
  setComposeOpen: (v: boolean) => void
  paletteOpen: boolean
  setPaletteOpen: (v: boolean) => void
  memberId: string | null
  openMember: (id: string | null) => void
  /** Seeds the assistant with a question when jumping in from elsewhere. */
  assistantSeed: string | null
  askAssistant: (q: string) => void
  clearSeed: () => void
}

const Ctx = createContext<UIState | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const { prefs, setPrefs } = useApp()
  const [view, setView] = useState<ViewId>((prefs.lastView as ViewId) || 'dashboard')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [assistantSeed, setAssistantSeed] = useState<string | null>(null)

  const go = useCallback(
    (next: ViewId) => {
      setView(next)
      setPrefs({ lastView: next })
    },
    [setPrefs],
  )

  const askAssistant = useCallback(
    (q: string) => {
      setAssistantSeed(q)
      go('assistant')
    },
    [go],
  )

  const value = useMemo<UIState>(
    () => ({
      view,
      go,
      taskId,
      openTask: setTaskId,
      composeOpen,
      setComposeOpen,
      paletteOpen,
      setPaletteOpen,
      memberId,
      openMember: setMemberId,
      assistantSeed,
      askAssistant,
      clearSeed: () => setAssistantSeed(null),
    }),
    [view, go, taskId, composeOpen, paletteOpen, memberId, assistantSeed, askAssistant],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUI(): UIState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}
