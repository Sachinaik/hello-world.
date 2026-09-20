import { globalShortcut } from 'electron'
import type Database from 'better-sqlite3'
import { getAllSettings } from '../db/repo/settings'
import * as timerService from './timerService'
import { notifyTimerChanged } from '../ipc/registerHandlers'

// Only the start/pause and stop shortcuts are registered here, through
// Electron's globalShortcut — they work system-wide per the spec. Quick-add
// (Cmd+K) is deliberately NOT global: it is an in-window shortcut, handled
// entirely by a keydown listener in the renderer so it never fires while
// some other application has focus.

export class ShortcutManager {
  private registrationErrors: string[] = []

  constructor(private readonly db: Database.Database) {}

  reload(): void {
    globalShortcut.unregisterAll()
    this.registrationErrors = []

    const settings = getAllSettings(this.db)
    this.registerOne(settings.shortcutStartPause, 'start/pause the timer', () => {
      const active = timerService.getActiveTimer(this.db)
      if (active) {
        timerService.pauseTimer(this.db)
      } else {
        // Resume needs a target project/subtask; without one running there
        // is nothing sensible to start, so this only acts when a timer
        // was already going. The renderer's own UI covers the cold-start case.
      }
      notifyTimerChanged()
    })
    this.registerOne(settings.shortcutStop, 'stop the timer', () => {
      timerService.stopTimer(this.db)
      notifyTimerChanged()
    })
  }

  private registerOne(accelerator: string, label: string, handler: () => void): void {
    if (!accelerator) return
    try {
      const ok = globalShortcut.register(accelerator, handler)
      if (!ok) {
        this.registrationErrors.push(
          `Could not register "${accelerator}" to ${label} — another application may already be using this shortcut.`
        )
      }
    } catch {
      this.registrationErrors.push(`"${accelerator}" is not a valid shortcut for ${label}.`)
    }
  }

  getRegistrationErrors(): string[] {
    return this.registrationErrors
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}
