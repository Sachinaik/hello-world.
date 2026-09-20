import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb } from './helpers/testDb'
import { createProject, getProject } from '@main/db/repo/projects'
import { createSubtask, deleteSubtask, listSubtasksForProject } from '@main/db/repo/subtasks'

function insertEntry(
  db: Database.Database,
  projectId: number,
  subtaskId: number | null,
  durationSeconds: number,
  localDate = '2024-05-01'
): void {
  const now = Date.now()
  db.prepare(
    `INSERT INTO time_entries
      (project_id, subtask_id, started_at, ended_at, duration_seconds, local_date, entry_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?)`
  ).run(projectId, subtaskId, now, now + durationSeconds * 1000, durationSeconds, localDate, now, now)
}

describe('project totals — direct + subtask = total', () => {
  let db: Database.Database
  let projectId: number
  let subtaskAId: number
  let subtaskBId: number

  beforeEach(() => {
    db = createTestDb()
    const project = createProject(db, { name: 'Fixture Project' })
    projectId = project.id
    subtaskAId = createSubtask(db, { projectId, title: 'Subtask A' }).id
    subtaskBId = createSubtask(db, { projectId, title: 'Subtask B' }).id

    insertEntry(db, projectId, null, 600) // 10 min direct
    insertEntry(db, projectId, null, 300) // 5 min direct
    insertEntry(db, projectId, subtaskAId, 1200) // 20 min on A
    insertEntry(db, projectId, subtaskBId, 900) // 15 min on B
  })

  it('project total equals direct time plus the sum of subtask time', () => {
    const project = getProject(db, projectId)!
    expect(project.totals.directSeconds).toBe(900)
    expect(project.totals.subtaskSeconds).toBe(2100)
    expect(project.totals.totalSeconds).toBe(3000)
    expect(project.totals.directSeconds + project.totals.subtaskSeconds).toBe(project.totals.totalSeconds)
  })

  it('deleting a subtask reassigns its entries to project-level time and leaves the project total unchanged', () => {
    const before = getProject(db, projectId)!.totals.totalSeconds

    deleteSubtask(db, subtaskAId)

    const after = getProject(db, projectId)!.totals
    expect(after.totalSeconds).toBe(before)
    expect(after.directSeconds).toBe(900 + 1200) // reassigned entries now count as direct
    expect(after.subtaskSeconds).toBe(900) // only subtask B remains

    const remainingSubtasks = listSubtasksForProject(db, projectId)
    expect(remainingSubtasks.map((s) => s.id)).not.toContain(subtaskAId)

    const reassigned = db
      .prepare(`SELECT subtask_id FROM time_entries WHERE duration_seconds = 1200`)
      .get() as { subtask_id: number | null }
    expect(reassigned.subtask_id).toBeNull()
  })
})
