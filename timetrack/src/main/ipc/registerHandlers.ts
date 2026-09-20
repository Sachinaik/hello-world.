import { ipcMain, BrowserWindow, app } from 'electron'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '@shared/ipc-contract'
import * as projectsRepo from '../db/repo/projects'
import * as subtasksRepo from '../db/repo/subtasks'
import * as entriesRepo from '../db/repo/entries'
import * as tagsRepo from '../db/repo/tags'
import * as settingsRepo from '../db/repo/settings'
import { getDashboardSummary } from '../db/repo/dashboard'
import { getReportTotals } from '../db/repo/reports'
import * as timerService from '../services/timerService'
import { loadSeedData, removeSeedData } from '../services/seedData'
import {
  backupDatabaseFile,
  exportJsonPayload,
  importJsonPayload,
  restoreDatabaseFile
} from '../services/dataManagement'
import { getDbPath, closeDatabase } from '../db/connection'
import type { ShortcutManager } from '../services/shortcutManager'
import { getPendingSleepPrompt, resolveSleepPrompt } from '../services/powerMonitorService'

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

export function notifyTimerChanged(): void {
  broadcast(IPC_CHANNELS['events:timerChanged'])
}

export function registerIpcHandlers(db: Database.Database, shortcutManager: ShortcutManager): void {
  const h = <T extends unknown[], R>(channel: string, fn: (...args: T) => R): void => {
    ipcMain.handle(channel, (_event, ...args: unknown[]) => fn(...(args as T)))
  }

  // ---- Projects ----
  h(IPC_CHANNELS['projects:list'], (filter?: Parameters<typeof projectsRepo.listProjects>[1]) =>
    projectsRepo.listProjects(db, filter)
  )
  h(IPC_CHANNELS['projects:get'], (id: number) => projectsRepo.getProject(db, id))
  h(IPC_CHANNELS['projects:create'], (input: Parameters<typeof projectsRepo.createProject>[1]) =>
    projectsRepo.createProject(db, input)
  )
  h(
    IPC_CHANNELS['projects:update'],
    (id: number, patch: Parameters<typeof projectsRepo.updateProject>[2]) =>
      projectsRepo.updateProject(db, id, patch)
  )
  h(IPC_CHANNELS['projects:archive'], (id: number) => projectsRepo.archiveProject(db, id))
  h(IPC_CHANNELS['projects:restore'], (id: number) => projectsRepo.restoreProject(db, id))
  h(IPC_CHANNELS['projects:complete'], (id: number) => projectsRepo.completeProject(db, id))
  h(IPC_CHANNELS['projects:reopen'], (id: number) => projectsRepo.reopenProject(db, id))
  h(IPC_CHANNELS['projects:deletePreview'], (id: number) => projectsRepo.deleteProjectPreview(db, id))
  h(IPC_CHANNELS['projects:delete'], (id: number) => projectsRepo.deleteProject(db, id))
  h(IPC_CHANNELS['projects:exportCsv'], (id: number) => projectsRepo.exportProjectCsv(db, id))

  // ---- Subtasks ----
  h(IPC_CHANNELS['subtasks:listForProject'], (projectId: number) =>
    subtasksRepo.listSubtasksForProject(db, projectId)
  )
  h(IPC_CHANNELS['subtasks:create'], (input: Parameters<typeof subtasksRepo.createSubtask>[1]) =>
    subtasksRepo.createSubtask(db, input)
  )
  h(
    IPC_CHANNELS['subtasks:update'],
    (id: number, patch: Parameters<typeof subtasksRepo.updateSubtask>[2]) =>
      subtasksRepo.updateSubtask(db, id, patch)
  )
  h(IPC_CHANNELS['subtasks:reorder'], (projectId: number, orderedIds: number[]) =>
    subtasksRepo.reorderSubtasks(db, projectId, orderedIds)
  )
  h(IPC_CHANNELS['subtasks:complete'], (id: number) => subtasksRepo.updateSubtask(db, id, { status: 'completed' }))
  h(IPC_CHANNELS['subtasks:archive'], (id: number) => subtasksRepo.updateSubtask(db, id, { status: 'archived' }))
  h(IPC_CHANNELS['subtasks:deletePreview'], (id: number) => subtasksRepo.deleteSubtaskPreview(db, id))
  h(IPC_CHANNELS['subtasks:delete'], (id: number) => subtasksRepo.deleteSubtask(db, id))

  // ---- Timer ----
  h(IPC_CHANNELS['timer:getActive'], () => timerService.getActiveTimer(db))
  h(IPC_CHANNELS['timer:start'], (projectId: number, subtaskId: number | null) => {
    const result = timerService.startTimer(db, projectId, subtaskId)
    if ('entry' in result) notifyTimerChanged()
    return result
  })
  h(IPC_CHANNELS['timer:confirmSwitchAndStart'], (projectId: number, subtaskId: number | null) => {
    const entry = timerService.confirmSwitchAndStart(db, projectId, subtaskId)
    notifyTimerChanged()
    return entry
  })
  h(IPC_CHANNELS['timer:pause'], () => {
    timerService.pauseTimer(db)
    notifyTimerChanged()
  })
  h(IPC_CHANNELS['timer:resume'], (projectId: number, subtaskId: number | null) => {
    const entry = timerService.resumeTimer(db, projectId, subtaskId)
    notifyTimerChanged()
    return entry
  })
  h(IPC_CHANNELS['timer:stop'], () => {
    timerService.stopTimer(db)
    notifyTimerChanged()
  })
  h(IPC_CHANNELS['timer:checkCrashRecovery'], () => timerService.getCrashRecoveryInfo(db))
  h(
    IPC_CHANNELS['timer:resolveCrashRecovery'],
    (choice: Parameters<typeof timerService.resolveCrashRecovery>[1]) => {
      timerService.resolveCrashRecovery(db, choice)
      notifyTimerChanged()
    }
  )
  h(IPC_CHANNELS['timer:checkSleepResume'], () => getPendingSleepPrompt())
  h(IPC_CHANNELS['timer:resolveSleepResume'], (shouldResume: boolean) => {
    resolveSleepPrompt(db, shouldResume)
  })

  // ---- Entries ----
  h(IPC_CHANNELS['entries:createManual'], (input: Parameters<typeof entriesRepo.createManualEntry>[1]) =>
    entriesRepo.createManualEntry(db, input)
  )
  h(IPC_CHANNELS['entries:checkOverlap'], (projectId: number, startedAt: number, endedAt: number) =>
    entriesRepo.checkOverlap(db, projectId, startedAt, endedAt)
  )
  h(IPC_CHANNELS['entries:update'], (input: Parameters<typeof entriesRepo.updateEntry>[1]) => {
    const result = entriesRepo.updateEntry(db, input)
    notifyTimerChanged()
    return result
  })
  h(IPC_CHANNELS['entries:delete'], (id: number) => {
    entriesRepo.deleteEntry(db, id)
    notifyTimerChanged()
  })
  h(IPC_CHANNELS['entries:history'], (filter: Parameters<typeof entriesRepo.getHistory>[1]) =>
    entriesRepo.getHistory(db, filter ?? {})
  )
  h(
    IPC_CHANNELS['entries:listForProject'],
    (projectId: number, filter?: Parameters<typeof entriesRepo.listEntriesForProject>[2]) =>
      entriesRepo.listEntriesForProject(db, projectId, filter)
  )

  // ---- Dashboard / Reports ----
  h(IPC_CHANNELS['dashboard:summary'], () => getDashboardSummary(db))
  h(IPC_CHANNELS['reports:totals'], (filter: Parameters<typeof getReportTotals>[1]) =>
    getReportTotals(db, filter ?? {})
  )

  // ---- Tags ----
  h(IPC_CHANNELS['tags:list'], () => tagsRepo.listTags(db))
  h(IPC_CHANNELS['tags:create'], (name: string) => tagsRepo.createTag(db, name))
  h(IPC_CHANNELS['tags:setForProject'], (projectId: number, tagIds: number[]) =>
    tagsRepo.setTagsForProject(db, projectId, tagIds)
  )

  // ---- Settings ----
  h(IPC_CHANNELS['settings:getAll'], () => settingsRepo.getAllSettings(db))
  h(IPC_CHANNELS['settings:set'], (key: string, value: string) => {
    settingsRepo.setSetting(db, key, value)
    if (key.startsWith('shortcut')) shortcutManager.reload()
  })

  // ---- Data (backup / export / import / seed) ----
  h(IPC_CHANNELS['data:backupDatabase'], () => ({ filePath: backupDatabaseFile(db, getDbPath()) }))
  h(IPC_CHANNELS['data:exportJson'], () => exportJsonPayload(db))
  h(IPC_CHANNELS['data:importJson'], (payload: Parameters<typeof importJsonPayload>[1]) => {
    backupDatabaseFile(db, getDbPath())
    importJsonPayload(db, payload)
    notifyTimerChanged()
  })
  // Restoring replaces the database file on disk; the safest way to make
  // every in-memory reference (this connection, the timer service, the
  // heartbeat loop) consistent again is a full app relaunch rather than
  // trying to swap the connection out from under running code.
  h(IPC_CHANNELS['data:restoreFromFile'], (sourcePath: string) => {
    closeDatabase()
    restoreDatabaseFile(getDbPath(), sourcePath)
    app.relaunch()
    app.exit(0)
  })
  h(IPC_CHANNELS['data:loadSeedData'], () => {
    loadSeedData(db)
    notifyTimerChanged()
  })
  h(IPC_CHANNELS['data:removeSeedData'], () => {
    removeSeedData(db)
    notifyTimerChanged()
  })
  h(IPC_CHANNELS['data:getDbPath'], () => getDbPath())

  // ---- Shortcuts ----
  h(IPC_CHANNELS['shortcuts:getRegistrationErrors'], () => shortcutManager.getRegistrationErrors())
}
