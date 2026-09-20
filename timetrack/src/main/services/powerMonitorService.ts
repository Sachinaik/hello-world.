import { powerMonitor, BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import type { SleepResumePrompt } from '@shared/types'
import * as timerService from './timerService'
import { IPC_CHANNELS } from '@shared/ipc-contract'
import { notifyTimerChanged } from '../ipc/registerHandlers'

let pendingPrompt: SleepResumePrompt | null = null

function broadcastSleepPrompt(prompt: SleepResumePrompt): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC_CHANNELS['events:sleepResumeNeeded'], prompt)
  }
}

/**
 * On suspend, the open entry (if any) is closed at the suspend instant —
 * sleep time is never silently counted as work. On resume, the renderer is
 * asked whether to start a fresh entry on the same item; getPendingPrompt
 * covers the case where the event fires before any window is ready to
 * receive it.
 */
export function initPowerMonitor(db: Database.Database): void {
  powerMonitor.on('suspend', () => {
    const active = timerService.getActiveTimer(db)
    if (!active) return
    const closed = timerService.closeAtSuspend(db, Date.now())
    if (!closed) return
    pendingPrompt = {
      entry: closed,
      projectName: active.projectName,
      subtaskTitle: active.subtaskTitle,
      suspendedAt: closed.endedAt ?? Date.now()
    }
    notifyTimerChanged()
  })

  powerMonitor.on('resume', () => {
    if (pendingPrompt) broadcastSleepPrompt(pendingPrompt)
  })
}

export function getPendingSleepPrompt(): SleepResumePrompt | null {
  return pendingPrompt
}

export function resolveSleepPrompt(db: Database.Database, shouldResume: boolean): void {
  const prompt = pendingPrompt
  pendingPrompt = null
  if (shouldResume && prompt) {
    timerService.resumeTimer(db, prompt.entry.projectId, prompt.entry.subtaskId)
    notifyTimerChanged()
  }
}
