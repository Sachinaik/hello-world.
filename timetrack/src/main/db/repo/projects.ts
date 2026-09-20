import type Database from 'better-sqlite3'
import type { Project, ProjectStatus, ProjectTotals, ProjectWithTotals } from '@shared/types'
import { mapProject, type ProjectRow } from '../mappers'
import { currentLocalDateRange } from './dateRanges'
import { formatDurationCompact } from '@shared/duration'

interface TotalsRow {
  total_seconds: number | null
  direct_seconds: number | null
  today_seconds: number | null
  week_seconds: number | null
  last_worked_local_date: string | null
  subtask_count: number
  completed_subtask_count: number
}

function computeTotals(db: Database.Database, projectId: number): ProjectTotals {
  const { today, weekStart } = currentLocalDateRange()

  const row = db
    .prepare(
      `
      SELECT
        (SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries WHERE project_id = ?) AS total_seconds,
        (SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries WHERE project_id = ? AND subtask_id IS NULL) AS direct_seconds,
        (SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries WHERE project_id = ? AND local_date = ?) AS today_seconds,
        (SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries WHERE project_id = ? AND local_date >= ?) AS week_seconds,
        (SELECT MAX(local_date) FROM time_entries WHERE project_id = ?) AS last_worked_local_date,
        (SELECT COUNT(*) FROM subtasks WHERE project_id = ? AND status != 'archived') AS subtask_count,
        (SELECT COUNT(*) FROM subtasks WHERE project_id = ? AND status = 'completed') AS completed_subtask_count
      `
    )
    .get(projectId, projectId, projectId, today, projectId, weekStart, projectId, projectId, projectId) as TotalsRow

  const trackingRow = db
    .prepare(
      `
      SELECT 1 FROM active_timer
      JOIN time_entries ON time_entries.id = active_timer.time_entry_id
      WHERE time_entries.project_id = ?
      `
    )
    .get(projectId)

  const totalSeconds = row.total_seconds ?? 0
  const directSeconds = row.direct_seconds ?? 0

  return {
    projectId,
    totalSeconds,
    directSeconds,
    subtaskSeconds: totalSeconds - directSeconds,
    todaySeconds: row.today_seconds ?? 0,
    weekSeconds: row.week_seconds ?? 0,
    lastWorkedLocalDate: row.last_worked_local_date,
    subtaskCount: row.subtask_count,
    completedSubtaskCount: row.completed_subtask_count,
    isTrackingNow: !!trackingRow
  }
}

function withTotals(db: Database.Database, row: ProjectRow): ProjectWithTotals {
  const project = mapProject(row)
  return { ...project, totals: computeTotals(db, project.id) }
}

export function listProjects(
  db: Database.Database,
  filter?: { status?: ProjectStatus; search?: string }
): ProjectWithTotals[] {
  const clauses: string[] = ['deleted = 0']
  const params: unknown[] = []

  if (filter?.status) {
    clauses.push('status = ?')
    params.push(filter.status)
  }
  if (filter?.search) {
    clauses.push('(name LIKE ? OR description LIKE ?)')
    const like = `%${filter.search}%`
    params.push(like, like)
  }

  const rows = db
    .prepare(`SELECT * FROM projects WHERE ${clauses.join(' AND ')} ORDER BY name COLLATE NOCASE`)
    .all(...params) as ProjectRow[]

  return rows.map((row) => withTotals(db, row))
}

export function getProject(db: Database.Database, id: number): ProjectWithTotals | null {
  const row = db.prepare(`SELECT * FROM projects WHERE id = ? AND deleted = 0`).get(id) as
    | ProjectRow
    | undefined
  if (!row) return null
  return withTotals(db, row)
}

export function createProject(
  db: Database.Database,
  input: {
    name: string
    description?: string | null
    color?: string | null
    category?: string | null
    startedAt?: number | null
  }
): Project {
  const now = Date.now()
  const result = db
    .prepare(
      `INSERT INTO projects (name, description, status, color, category, started_at, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, ?, ?, ?)`
    )
    .run(
      input.name,
      input.description ?? null,
      input.color ?? null,
      input.category ?? null,
      input.startedAt ?? now,
      now,
      now
    )
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(result.lastInsertRowid) as ProjectRow
  return mapProject(row)
}

export function updateProject(
  db: Database.Database,
  id: number,
  patch: Partial<{
    name: string
    description: string | null
    color: string | null
    category: string | null
    status: ProjectStatus
    startedAt: number | null
    completedAt: number | null
  }>
): Project {
  const fields: string[] = []
  const params: unknown[] = []

  const columnMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    color: 'color',
    category: 'category',
    status: 'status',
    startedAt: 'started_at',
    completedAt: 'completed_at'
  }

  for (const [key, column] of Object.entries(columnMap)) {
    if (key in patch) {
      fields.push(`${column} = ?`)
      params.push((patch as Record<string, unknown>)[key])
    }
  }

  fields.push('updated_at = ?')
  params.push(Date.now())
  params.push(id)

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow
  return mapProject(row)
}

export function archiveProject(db: Database.Database, id: number): Project {
  const now = Date.now()
  db.prepare(`UPDATE projects SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?`).run(
    now,
    now,
    id
  )
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow
  return mapProject(row)
}

export function restoreProject(db: Database.Database, id: number): Project {
  const now = Date.now()
  db.prepare(
    `UPDATE projects SET status = 'active', archived_at = NULL, deleted = 0, updated_at = ? WHERE id = ?`
  ).run(now, id)
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow
  return mapProject(row)
}

export function completeProject(db: Database.Database, id: number): Project {
  const now = Date.now()
  db.prepare(`UPDATE projects SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`).run(
    now,
    now,
    id
  )
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow
  return mapProject(row)
}

export function reopenProject(db: Database.Database, id: number): Project {
  const now = Date.now()
  db.prepare(
    `UPDATE projects SET status = 'active', completed_at = NULL, updated_at = ? WHERE id = ?`
  ).run(now, id)
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow
  return mapProject(row)
}

export function deleteProjectPreview(
  db: Database.Database,
  id: number
): { entryCount: number; subtaskCount: number } {
  const entryCount = (
    db.prepare(`SELECT COUNT(*) as c FROM time_entries WHERE project_id = ?`).get(id) as { c: number }
  ).c
  const subtaskCount = (
    db.prepare(`SELECT COUNT(*) as c FROM subtasks WHERE project_id = ?`).get(id) as { c: number }
  ).c
  return { entryCount, subtaskCount }
}

/**
 * Soft-deletes a project. Entries and subtasks are never touched: they
 * remain reachable from reports and history exactly as the spec requires.
 * A project with no tracked time and no subtasks is still soft-deleted
 * (rather than hard-deleted) for consistency and simple undo via restore.
 */
export function deleteProject(db: Database.Database, id: number): void {
  const now = Date.now()
  db.prepare(
    `UPDATE projects SET deleted = 1, archived_at = COALESCE(archived_at, ?), status = 'archived', updated_at = ? WHERE id = ?`
  ).run(now, now, id)
}

export function exportProjectCsv(db: Database.Database, id: number): string {
  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow | undefined
  if (!project) throw new Error('Project not found')

  interface EntryExportRow {
    started_at: number
    ended_at: number | null
    duration_seconds: number | null
    local_date: string
    entry_type: string
    note: string | null
    subtask_title: string | null
  }

  const rows = db
    .prepare(
      `
      SELECT te.started_at, te.ended_at, te.duration_seconds, te.local_date, te.entry_type, te.note, s.title as subtask_title
      FROM time_entries te
      LEFT JOIN subtasks s ON s.id = te.subtask_id
      WHERE te.project_id = ?
      ORDER BY te.started_at ASC
      `
    )
    .all(id) as EntryExportRow[]

  const header = [
    'date',
    'project',
    'subtask',
    'start_time',
    'end_time',
    'duration',
    'decimal_hours',
    'entry_type',
    'note'
  ]

  const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`
  const lines = [header.join(',')]
  for (const r of rows) {
    const start = new Date(r.started_at)
    const end = r.ended_at ? new Date(r.ended_at) : null
    const durationSeconds = r.duration_seconds ?? 0
    lines.push(
      [
        r.local_date,
        csvEscape(project.name),
        r.subtask_title ? csvEscape(r.subtask_title) : '',
        start.toLocaleTimeString(),
        end ? end.toLocaleTimeString() : '',
        formatDurationCompact(durationSeconds),
        (durationSeconds / 3600).toFixed(2),
        r.entry_type,
        r.note ? csvEscape(r.note) : ''
      ].join(',')
    )
  }

  return lines.join('\n')
}
