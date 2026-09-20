import type Database from 'better-sqlite3'
import type { Priority, Subtask, SubtaskStatus, SubtaskTotals, SubtaskWithTotals } from '@shared/types'
import { mapSubtask, type SubtaskRow } from '../mappers'
import { todayLocalDate } from '@shared/localDate'

function computeTotals(db: Database.Database, subtaskId: number): SubtaskTotals {
  const today = todayLocalDate()
  const row = db
    .prepare(
      `
      SELECT
        (SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries WHERE subtask_id = ?) AS total_seconds,
        (SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries WHERE subtask_id = ? AND local_date = ?) AS today_seconds
      `
    )
    .get(subtaskId, subtaskId, today) as { total_seconds: number; today_seconds: number }
  return { subtaskId, totalSeconds: row.total_seconds, todaySeconds: row.today_seconds }
}

export function listSubtasksForProject(db: Database.Database, projectId: number): SubtaskWithTotals[] {
  const rows = db
    .prepare(`SELECT * FROM subtasks WHERE project_id = ? ORDER BY position ASC`)
    .all(projectId) as SubtaskRow[]
  return rows.map((row) => {
    const subtask = mapSubtask(row)
    return { ...subtask, totals: computeTotals(db, subtask.id) }
  })
}

export function createSubtask(
  db: Database.Database,
  input: {
    projectId: number
    title: string
    description?: string | null
    priority?: Priority | null
    estimatedMinutes?: number | null
    dueDate?: string | null
  }
): Subtask {
  const now = Date.now()
  const maxPosition = db
    .prepare(`SELECT COALESCE(MAX(position), -1) as p FROM subtasks WHERE project_id = ?`)
    .get(input.projectId) as { p: number }

  const result = db
    .prepare(
      `INSERT INTO subtasks
        (project_id, title, description, status, priority, estimated_minutes, due_date, position, created_at, updated_at)
       VALUES (?, ?, ?, 'not_started', ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.projectId,
      input.title,
      input.description ?? null,
      input.priority ?? null,
      input.estimatedMinutes ?? null,
      input.dueDate ?? null,
      maxPosition.p + 1,
      now,
      now
    )

  const row = db.prepare(`SELECT * FROM subtasks WHERE id = ?`).get(result.lastInsertRowid) as SubtaskRow
  return mapSubtask(row)
}

export function updateSubtask(
  db: Database.Database,
  id: number,
  patch: Partial<{
    title: string
    description: string | null
    status: SubtaskStatus
    priority: Priority | null
    estimatedMinutes: number | null
    dueDate: string | null
    position: number
  }>
): Subtask {
  const fields: string[] = []
  const params: unknown[] = []
  const columnMap: Record<string, string> = {
    title: 'title',
    description: 'description',
    status: 'status',
    priority: 'priority',
    estimatedMinutes: 'estimated_minutes',
    dueDate: 'due_date',
    position: 'position'
  }

  for (const [key, column] of Object.entries(columnMap)) {
    if (key in patch) {
      fields.push(`${column} = ?`)
      params.push((patch as Record<string, unknown>)[key])
    }
  }

  if ('status' in patch && patch.status === 'completed') {
    fields.push('completed_at = ?')
    params.push(Date.now())
  }

  fields.push('updated_at = ?')
  params.push(Date.now())
  params.push(id)

  db.prepare(`UPDATE subtasks SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  const row = db.prepare(`SELECT * FROM subtasks WHERE id = ?`).get(id) as SubtaskRow
  return mapSubtask(row)
}

export function reorderSubtasks(db: Database.Database, projectId: number, orderedIds: number[]): void {
  const update = db.prepare(
    `UPDATE subtasks SET position = ?, updated_at = ? WHERE id = ? AND project_id = ?`
  )
  const now = Date.now()
  const applyAll = db.transaction((ids: number[]) => {
    ids.forEach((id, index) => update.run(index, now, id, projectId))
  })
  applyAll(orderedIds)
}

export function deleteSubtaskPreview(db: Database.Database, id: number): { entryCount: number } {
  const entryCount = (
    db.prepare(`SELECT COUNT(*) as c FROM time_entries WHERE subtask_id = ?`).get(id) as { c: number }
  ).c
  return { entryCount }
}

/**
 * Deleting a subtask reassigns its entries to project-level time
 * (subtask_id = NULL) rather than deleting them, so the project total is
 * unaffected. This happens in a single transaction with the delete.
 */
export function deleteSubtask(db: Database.Database, id: number): void {
  const reassignAndDelete = db.transaction(() => {
    db.prepare(`UPDATE time_entries SET subtask_id = NULL, updated_at = ? WHERE subtask_id = ?`).run(
      Date.now(),
      id
    )
    db.prepare(`DELETE FROM subtasks WHERE id = ?`).run(id)
  })
  reassignAndDelete()
}
