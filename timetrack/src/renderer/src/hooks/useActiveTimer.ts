import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimeEntry } from '@shared/types'

export interface ActiveTimerState {
  entry: TimeEntry
  projectName: string
  subtaskTitle: string | null
}

export interface LastActiveItem {
  projectId: number
  subtaskId: number | null
  projectName: string
  subtaskTitle: string | null
}

export function useActiveTimer(): {
  active: ActiveTimerState | null
  elapsedSeconds: number
  refresh: () => void
  lastActive: LastActiveItem | null
} {
  const [active, setActive] = useState<ActiveTimerState | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [lastActive, setLastActive] = useState<LastActiveItem | null>(null)
  const previousRef = useRef<ActiveTimerState | null>(null)

  const refresh = useCallback(() => {
    window.api.timer.getActive().then((next) => {
      if (!next && previousRef.current) {
        const prev = previousRef.current
        setLastActive({
          projectId: prev.entry.projectId,
          subtaskId: prev.entry.subtaskId,
          projectName: prev.projectName,
          subtaskTitle: prev.subtaskTitle
        })
      }
      previousRef.current = next
      setActive(next)
    })
  }, [])

  useEffect(() => {
    refresh()
    const unsubscribe = window.api.events.onTimerChanged(refresh)
    return unsubscribe
  }, [refresh])

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0)
      return
    }
    const tick = (): void => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - active.entry.startedAt) / 1000)))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [active])

  return { active, elapsedSeconds, refresh, lastActive }
}
