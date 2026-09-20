import type Database from 'better-sqlite3'
import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import type { JsonExportPayload } from '@shared/types'
import { mapProject, mapSubtask, mapTag, mapTimeEntry } from '../db/mappers'
import { CURRENT_SCHEMA_VERSION } from '../db/migrations'

export function getBackupsDir(): string {
  const dir = join(app.getPath('userData'), 'backups')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Checkpoints WAL into the main file, then copies it to the backups directory. */
export function backupDatabaseFile(db: Database.Database, dbPath: string): string {
  db.pragma('wal_checkpoint(TRUNCATE)')
  const dir = getBackupsDir()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const destination = join(dir, `timetrack-backup-${stamp}.sqlite3`)
  copyFileSync(dbPath, destination)
  return destination
}

export function exportJsonPayload(db: Database.Database): JsonExportPayload {
  const projects = (db.prepare(`SELECT * FROM projects`).all() as Parameters<typeof mapProject>[0][]).map(
    mapProject
  )
  const subtasks = (db.prepare(`SELECT * FROM subtasks`).all() as Parameters<typeof mapSubtask>[0][]).map(
    mapSubtask
  )
  const timeEntries = (
    db.prepare(`SELECT * FROM time_entries`).all() as Parameters<typeof mapTimeEntry>[0][]
  ).map(mapTimeEntry)
  const tags = (db.prepare(`SELECT * FROM tags`).all() as Parameters<typeof mapTag>[0][]).map(mapTag)
  const projectTags = db.prepare(`SELECT project_id, tag_id FROM project_tags`).all() as {
    project_id: number
    tag_id: number
  }[]

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    projects,
    subtasks,
    timeEntries,
    tags,
    projectTags: projectTags.map((r) => ({ projectId: r.project_id, tagId: r.tag_id }))
  }
}

/**
 * Full-portability import: replaces all current data with the payload's
 * contents, preserving original IDs so foreign keys stay valid. Intended
 * for moving a complete workspace to a fresh install, not merging.
 */
export function importJsonPayload(db: Database.Database, payload: JsonExportPayload): void {
  const run = db.transaction(() => {
    db.prepare(`DELETE FROM active_timer`).run()
    db.prepare(`DELETE FROM project_tags`).run()
    db.prepare(`DELETE FROM time_entries`).run()
    db.prepare(`DELETE FROM subtasks`).run()
    db.prepare(`DELETE FROM tags`).run()
    db.prepare(`DELETE FROM projects`).run()

    const insertProject = db.prepare(
      `INSERT INTO projects (id, name, description, status, color, category, started_at, completed_at, archived_at, deleted, created_at, updated_at)
       VALUES (@id, @name, @description, @status, @color, @category, @startedAt, @completedAt, @archivedAt, @deleted, @createdAt, @updatedAt)`
    )
    for (const p of payload.projects) insertProject.run(p as unknown as Record<string, unknown>)

    const insertSubtask = db.prepare(
      `INSERT INTO subtasks (id, project_id, title, description, status, priority, estimated_minutes, due_date, completed_at, position, created_at, updated_at)
       VALUES (@id, @projectId, @title, @description, @status, @priority, @estimatedMinutes, @dueDate, @completedAt, @position, @createdAt, @updatedAt)`
    )
    for (const s of payload.subtasks) insertSubtask.run(s as unknown as Record<string, unknown>)

    const insertEntry = db.prepare(
      `INSERT INTO time_entries (id, project_id, subtask_id, started_at, ended_at, duration_seconds, local_date, entry_type, note, last_heartbeat_at, created_at, updated_at)
       VALUES (@id, @projectId, @subtaskId, @startedAt, @endedAt, @durationSeconds, @localDate, @entryType, @note, @lastHeartbeatAt, @createdAt, @updatedAt)`
    )
    for (const e of payload.timeEntries) insertEntry.run(e as unknown as Record<string, unknown>)

    const insertTag = db.prepare(`INSERT INTO tags (id, name) VALUES (@id, @name)`)
    for (const t of payload.tags) insertTag.run(t as unknown as Record<string, unknown>)

    const insertProjectTag = db.prepare(
      `INSERT INTO project_tags (project_id, tag_id) VALUES (?, ?)`
    )
    for (const pt of payload.projectTags) insertProjectTag.run(pt.projectId, pt.tagId)
  })
  run()
}

/**
 * Replaces the live database file with another sqlite file (a prior
 * backup, typically). Caller must close the current connection before
 * calling this and reopen afterwards. An automatic safety backup of the
 * about-to-be-overwritten file is always taken first.
 */
export function restoreDatabaseFile(currentDbPath: string, sourcePath: string): string {
  if (!existsSync(sourcePath)) {
    throw new Error(`Restore file not found: ${sourcePath}`)
  }
  mkdirSync(dirname(currentDbPath), { recursive: true })
  const dir = getBackupsDir()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safetyBackupPath = join(dir, `pre-restore-safety-backup-${stamp}.sqlite3`)
  if (existsSync(currentDbPath)) {
    copyFileSync(currentDbPath, safetyBackupPath)
  }
  copyFileSync(sourcePath, currentDbPath)
  return safetyBackupPath
}
