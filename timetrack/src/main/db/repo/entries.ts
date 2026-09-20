import type Database from 'better-sqlite3'
import type {
  CreateManualEntryInput,
  EditEntryInput,
  HistoryDayGroup,
  HistoryFilter,
  OverlapWarning,
  TimeEntry,
  TimeEntryWithNames
} from '@shared/types'
import { mapTimeEntry, type TimeEntryRow } from '../mappers'
import { localDateFromEpoch } from '@shared/localDate'
import { computeDurationSeconds } from '../../services/timerService'

function localDateTimeToEpoch(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

export class ManualEntryValidationError extends Error {}

export function createManualEntry(db: Database.Database, input: CreateManualEntryInput): TimeEntry {
  let startedAt: number
  let endedAt: number

  if (input.durationMinutes != null) {
    // Anchor a duration-only entry at 09:00 local on the given date so it
    // has a concrete, editable start time rather than a synthetic one.
    startedAt = localDateTimeToEpoch(input.date, '09:00')
    endedAt = startedAt + input.durationMinutes * 60 * 1000
  } else if (input.startTime && input.endTime) {
    startedAt = localDateTimeToEpoch(input.date, input.startTime)
    endedAt = localDateTimeToEpoch(input.date, input.endTime)
    if (endedAt <= startedAt) {
      // crosses midnight within the same manual entry — extend to next day
      endedAt += 24 * 60 * 60 * 1000
    }
  } else {
    throw new ManualEntryValidationError('Provide either start/end time or a duration')
  }

  const now = Date.now()
  const localDate = localDateFromEpoch(startedAt)
  const durationSeconds = computeDurationSeconds(startedAt, endedAt)

  const result = db
    .prepare(
      `INSERT INTO time_entries
        (project_id, subtask_id, started_at, ended_at, duration_seconds, local_date, entry_type, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)`
    )
    .run(
      input.projectId,
      input.subtaskId,
      startedAt,
      endedAt,
      durationSeconds,
      localDate,
      input.note ?? null,
      now,
      now
    )

  const row = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(result.lastInsertRowid) as TimeEntryRow
  return mapTimeEntry(row)
}

export function checkOverlap(
  db: Database.Database,
  projectId: number,
  startedAt: number,
  endedAt: number,
  excludeEntryId?: number
): OverlapWarning {
  const rows = db
    .prepare(
      `
      SELECT te.started_at, te.ended_at, p.name as project_name
      FROM time_entries te
      JOIN projects p ON p.id = te.project_id
      WHERE te.project_id = ?
        AND te.ended_at IS NOT NULL
        AND te.started_at < ?
        AND te.ended_at > ?
        AND te.id != ?
      `
    )
    .all(projectId, endedAt, startedAt, excludeEntryId ?? -1) as {
    started_at: number
    ended_at: number
    project_name: string
  }[]

  return {
    overlapsWith: rows.map((r) => ({
      projectName: r.project_name,
      startedAt: r.started_at,
      endedAt: r.ended_at
    }))
  }
}

export function updateEntry(db: Database.Database, input: EditEntryInput): TimeEntry {
  const existing = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(input.id) as
    | TimeEntryRow
    | undefined
  if (!existing) throw new Error('Time entry not found')

  const projectId = input.projectId ?? existing.project_id
  const subtaskId = 'subtaskId' in input ? input.subtaskId ?? null : existing.subtask_id
  const startedAt = input.startedAt ?? existing.started_at
  const endedAt = 'endedAt' in input ? input.endedAt : existing.ended_at
  const note = 'note' in input ? input.note : existing.note

  const durationSeconds = endedAt != null ? computeDurationSeconds(startedAt, endedAt) : null
  const localDate = localDateFromEpoch(startedAt)

  db.prepare(
    `UPDATE time_entries
     SET project_id = ?, subtask_id = ?, started_at = ?, ended_at = ?, duration_seconds = ?, local_date = ?, note = ?, updated_at = ?
     WHERE id = ?`
  ).run(projectId, subtaskId, startedAt, endedAt, durationSeconds, localDate, note, Date.now(), input.id)

  const row = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(input.id) as TimeEntryRow
  return mapTimeEntry(row)
}

export function deleteEntry(db: Database.Database, id: number): void {
  db.prepare(`DELETE FROM active_timer WHERE time_entry_id = ?`).run(id)
  db.prepare(`DELETE FROM time_entries WHERE id = ?`).run(id)
}

interface EntryWithNamesRow extends TimeEntryRow {
  project_name: string
  subtask_title: string | null
}

function mapWithNames(row: EntryWithNamesRow): TimeEntryWithNames {
  const entry = mapTimeEntry(row)
  const crossesMidnight = entry.endedAt != null && localDateFromEpoch(entry.endedAt) !== entry.localDate
  return { ...entry, projectName: row.project_name, subtaskTitle: row.subtask_title, crossesMidnight }
}

function buildFilterClauses(filter: HistoryFilter): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []

  if (filter.startDate) {
    clauses.push('te.local_date >= ?')
    params.push(filter.startDate)
  }
  if (filter.endDate) {
    clauses.push('te.local_date <= ?')
    params.push(filter.endDate)
  }
  if (filter.projectId != null) {
    clauses.push('te.project_id = ?')
    params.push(filter.projectId)
  }
  if (filter.subtaskId != null) {
    clauses.push('te.subtask_id = ?')
    params.push(filter.subtaskId)
  }
  if (filter.entryType) {
    clauses.push('te.entry_type = ?')
    params.push(filter.entryType)
  }
  if (filter.projectStatus) {
    clauses.push('p.status = ?')
    params.push(filter.projectStatus)
  }
  if (filter.subtaskStatus) {
    clauses.push('s.status = ?')
    params.push(filter.subtaskStatus)
  }
  if (filter.tagId != null) {
    clauses.push('EXISTS (SELECT 1 FROM project_tags pt WHERE pt.project_id = te.project_id AND pt.tag_id = ?)')
    params.push(filter.tagId)
  }
  if (filter.hasNote != null) {
    clauses.push(filter.hasNote ? "(te.note IS NOT NULL AND te.note != '')" : "(te.note IS NULL OR te.note = '')")
  }
  if (filter.search) {
    clauses.push(
      `(p.name LIKE ? OR p.description LIKE ? OR s.title LIKE ? OR s.description LIKE ? OR te.note LIKE ?
        OR EXISTS (
          SELECT 1 FROM project_tags pt JOIN tags t ON t.id = pt.tag_id
          WHERE pt.project_id = te.project_id AND t.name LIKE ?
        ))`
    )
    const like = `%${filter.search}%`
    params.push(like, like, like, like, like, like)
  }

  return { clauses, params }
}

export function getHistory(db: Database.Database, filter: HistoryFilter): HistoryDayGroup[] {
  const { clauses, params } = buildFilterClauses(filter)
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `
      SELECT te.*, p.name as project_name, s.title as subtask_title
      FROM time_entries te
      JOIN projects p ON p.id = te.project_id
      LEFT JOIN subtasks s ON s.id = te.subtask_id
      ${where}
      ORDER BY te.local_date DESC, te.started_at DESC
      `
    )
    .all(...params) as EntryWithNamesRow[]

  const groups = new Map<string, HistoryDayGroup>()
  for (const row of rows) {
    const entry = mapWithNames(row)
    if (!groups.has(entry.localDate)) {
      groups.set(entry.localDate, { localDate: entry.localDate, totalSeconds: 0, entries: [] })
    }
    const group = groups.get(entry.localDate)!
    group.entries.push(entry)
    group.totalSeconds += entry.durationSeconds ?? 0
  }

  return Array.from(groups.values())
}

export function listEntriesForProject(
  db: Database.Database,
  projectId: number,
  filter?: HistoryFilter
): TimeEntryWithNames[] {
  const { clauses, params } = buildFilterClauses({ ...filter, projectId })
  const where = `WHERE ${clauses.join(' AND ')}`

  const rows = db
    .prepare(
      `
      SELECT te.*, p.name as project_name, s.title as subtask_title
      FROM time_entries te
      JOIN projects p ON p.id = te.project_id
      LEFT JOIN subtasks s ON s.id = te.subtask_id
      ${where}
      ORDER BY te.started_at DESC
      `
    )
    .all(...params) as EntryWithNamesRow[]

  return rows.map(mapWithNames)
}
