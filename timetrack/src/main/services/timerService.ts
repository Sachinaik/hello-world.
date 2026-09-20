import type Database from 'better-sqlite3'
import type { CrashRecoveryChoice, CrashRecoveryInfo, TimeEntry } from '@shared/types'
import { mapTimeEntry, type TimeEntryRow } from '../db/mappers'
import { localDateFromEpoch } from '@shared/localDate'

export function computeDurationSeconds(startedAt: number, endedAt: number): number {
  return Math.max(0, Math.round((endedAt - startedAt) / 1000))
}

export interface CurrentItemLabel {
  projectName: string
  subtaskTitle: string | null
}

function getOpenEntryRow(db: Database.Database): TimeEntryRow | undefined {
  return db.prepare(`SELECT * FROM time_entries WHERE ended_at IS NULL`).get() as
    | TimeEntryRow
    | undefined
}

export function getActiveTimer(
  db: Database.Database
): { entry: TimeEntry; projectName: string; subtaskTitle: string | null } | null {
  const row = getOpenEntryRow(db)
  if (!row) return null
  const label = getLabel(db, row.project_id, row.subtask_id)
  return { entry: mapTimeEntry(row), ...label }
}

function getLabel(db: Database.Database, projectId: number, subtaskId: number | null): CurrentItemLabel {
  const project = db.prepare(`SELECT name FROM projects WHERE id = ?`).get(projectId) as
    | { name: string }
    | undefined
  const subtask = subtaskId
    ? (db.prepare(`SELECT title FROM subtasks WHERE id = ?`).get(subtaskId) as { title: string } | undefined)
    : undefined
  return { projectName: project?.name ?? 'Unknown project', subtaskTitle: subtask?.title ?? null }
}

function insertOpenEntry(
  db: Database.Database,
  projectId: number,
  subtaskId: number | null,
  startedAt: number
): TimeEntry {
  const localDate = localDateFromEpoch(startedAt)
  const result = db
    .prepare(
      `INSERT INTO time_entries
        (project_id, subtask_id, started_at, ended_at, duration_seconds, local_date, entry_type, last_heartbeat_at, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, 'timer', ?, ?, ?)`
    )
    .run(projectId, subtaskId, startedAt, localDate, startedAt, startedAt, startedAt)

  db.prepare(`INSERT INTO active_timer (id, time_entry_id) VALUES (1, ?)`).run(result.lastInsertRowid)

  const row = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(result.lastInsertRowid) as TimeEntryRow
  return mapTimeEntry(row)
}

function closeEntry(db: Database.Database, entryId: number, endedAt: number): void {
  const entry = db.prepare(`SELECT started_at FROM time_entries WHERE id = ?`).get(entryId) as
    | { started_at: number }
    | undefined
  if (!entry) return
  const duration = computeDurationSeconds(entry.started_at, endedAt)
  db.prepare(
    `UPDATE time_entries SET ended_at = ?, duration_seconds = ?, updated_at = ? WHERE id = ?`
  ).run(endedAt, duration, endedAt, entryId)
  db.prepare(`DELETE FROM active_timer WHERE time_entry_id = ?`).run(entryId)
}

export type StartResult = { entry: TimeEntry } | { conflict: CurrentItemLabel }

/**
 * Starts a timer. If one is already running, returns a conflict descriptor
 * instead of starting — the caller (IPC layer) surfaces the "already
 * running" dialog and calls confirmSwitchAndStart if the user proceeds.
 * The one-open-entry guarantee is enforced at the schema level by a
 * partial unique index, so this check-then-insert can never race into two
 * open entries even if called concurrently.
 */
export function startTimer(
  db: Database.Database,
  projectId: number,
  subtaskId: number | null,
  now: number = Date.now()
): StartResult {
  const open = getOpenEntryRow(db)
  if (open) {
    return { conflict: getLabel(db, open.project_id, open.subtask_id) }
  }
  const entry = insertOpenEntry(db, projectId, subtaskId, now)
  return { entry }
}

/** Closes whatever entry is open (if any) and opens a new one, atomically. */
export function confirmSwitchAndStart(
  db: Database.Database,
  projectId: number,
  subtaskId: number | null,
  now: number = Date.now()
): TimeEntry {
  const run = db.transaction(() => {
    const open = getOpenEntryRow(db)
    if (open) closeEntry(db, open.id, now)
    return insertOpenEntry(db, projectId, subtaskId, now)
  })
  return run()
}

/**
 * Pausing closes the current entry outright. There is no accumulator and
 * no paused-but-running state: every row in time_entries is a real,
 * contiguous work period. Resuming (resumeTimer) simply opens a new one.
 */
export function pauseTimer(db: Database.Database, now: number = Date.now()): void {
  const open = getOpenEntryRow(db)
  if (!open) return
  closeEntry(db, open.id, now)
}

export function resumeTimer(
  db: Database.Database,
  projectId: number,
  subtaskId: number | null,
  now: number = Date.now()
): TimeEntry {
  const result = startTimer(db, projectId, subtaskId, now)
  if ('conflict' in result) {
    return confirmSwitchAndStart(db, projectId, subtaskId, now)
  }
  return result.entry
}

export function stopTimer(db: Database.Database, now: number = Date.now()): void {
  const open = getOpenEntryRow(db)
  if (!open) return
  closeEntry(db, open.id, now)
}

export function recordHeartbeat(db: Database.Database, now: number = Date.now()): void {
  const open = getOpenEntryRow(db)
  if (!open) return
  db.prepare(`UPDATE time_entries SET last_heartbeat_at = ? WHERE id = ?`).run(now, open.id)
}

/** Called on powerMonitor 'suspend': closes the open entry at suspend time. */
export function closeAtSuspend(db: Database.Database, suspendedAt: number): TimeEntry | null {
  const open = getOpenEntryRow(db)
  if (!open) return null
  closeEntry(db, open.id, suspendedAt)
  const row = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(open.id) as TimeEntryRow
  return mapTimeEntry(row)
}

export function getCrashRecoveryInfo(db: Database.Database): CrashRecoveryInfo | null {
  const open = getOpenEntryRow(db)
  if (!open) return null
  const label = getLabel(db, open.project_id, open.subtask_id)
  return {
    entry: mapTimeEntry(open),
    ...label,
    usedFallbackToStartedAt: open.last_heartbeat_at === null
  }
}

/**
 * Resolves a crash-recovered open entry per the user's chosen action.
 * All three paths close the stale entry; "closeAndContinue" additionally
 * opens a fresh entry on the same project/subtask so work can resume
 * immediately, with the heartbeat-to-now gap simply not counted.
 */
export function resolveCrashRecovery(
  db: Database.Database,
  choice: CrashRecoveryChoice,
  now: number = Date.now()
): void {
  const open = getOpenEntryRow(db)
  if (!open) return

  const closeAt = open.last_heartbeat_at ?? open.started_at

  const run = db.transaction(() => {
    if (choice.action === 'closeAndContinue') {
      closeEntry(db, open.id, closeAt)
      insertOpenEntry(db, open.project_id, open.subtask_id, now)
    } else if (choice.action === 'closeAndStop') {
      closeEntry(db, open.id, closeAt)
    } else {
      closeEntry(db, open.id, choice.endedAt)
    }
  })
  run()
}
