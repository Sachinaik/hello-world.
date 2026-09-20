import type Database from 'better-sqlite3'
import type { ReportFilter, ReportTotals } from '@shared/types'
import { weekStartForLocalDate, monthForLocalDate } from '@shared/localDate'

export function getReportTotals(db: Database.Database, filter: ReportFilter): ReportTotals {
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
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const grandTotal = (
    db
      .prepare(`SELECT COALESCE(SUM(te.duration_seconds), 0) as s FROM time_entries te ${where}`)
      .get(...params) as { s: number }
  ).s

  const byProject = db
    .prepare(
      `
      SELECT te.project_id as projectId, p.name as projectName, COALESCE(SUM(te.duration_seconds), 0) as totalSeconds
      FROM time_entries te
      JOIN projects p ON p.id = te.project_id
      ${where}
      GROUP BY te.project_id
      ORDER BY totalSeconds DESC
      `
    )
    .all(...params) as { projectId: number; projectName: string; totalSeconds: number }[]

  const bySubtask = db
    .prepare(
      `
      SELECT te.subtask_id as subtaskId, s.title as subtaskTitle, te.project_id as projectId, p.name as projectName,
             COALESCE(SUM(te.duration_seconds), 0) as totalSeconds
      FROM time_entries te
      JOIN projects p ON p.id = te.project_id
      JOIN subtasks s ON s.id = te.subtask_id
      ${where ? `${where} AND te.subtask_id IS NOT NULL` : 'WHERE te.subtask_id IS NOT NULL'}
      GROUP BY te.subtask_id
      ORDER BY totalSeconds DESC
      `
    )
    .all(...params) as {
    subtaskId: number
    subtaskTitle: string
    projectId: number
    projectName: string
    totalSeconds: number
  }[]

  const daily = db
    .prepare(
      `
      SELECT te.local_date as localDate, COALESCE(SUM(te.duration_seconds), 0) as totalSeconds
      FROM time_entries te
      ${where}
      GROUP BY te.local_date
      ORDER BY te.local_date ASC
      `
    )
    .all(...params) as { localDate: string; totalSeconds: number }[]

  const weeklyMap = new Map<string, number>()
  const monthlyMap = new Map<string, number>()
  for (const d of daily) {
    const weekStart = weekStartForLocalDate(d.localDate)
    weeklyMap.set(weekStart, (weeklyMap.get(weekStart) ?? 0) + d.totalSeconds)
    const month = monthForLocalDate(d.localDate)
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + d.totalSeconds)
  }
  const weekly = Array.from(weeklyMap.entries())
    .map(([weekStart, totalSeconds]) => ({ weekStart, totalSeconds }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  const monthly = Array.from(monthlyMap.entries())
    .map(([month, totalSeconds]) => ({ month, totalSeconds }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const activeVsCompleted = db
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM projects WHERE status = 'active' AND deleted = 0) as active,
        (SELECT COUNT(*) FROM projects WHERE status = 'completed' AND deleted = 0) as completed
      `
    )
    .get() as { active: number; completed: number }

  const mostRecentProjects = db
    .prepare(
      `
      SELECT te.project_id as projectId, p.name as projectName, MAX(te.local_date) as lastWorkedLocalDate
      FROM time_entries te
      JOIN projects p ON p.id = te.project_id
      GROUP BY te.project_id
      ORDER BY lastWorkedLocalDate DESC
      LIMIT 5
      `
    )
    .all() as { projectId: number; projectName: string; lastWorkedLocalDate: string }[]

  const topProjects = [...byProject].slice(0, 5)

  return {
    grandTotalSeconds: grandTotal,
    byProject,
    bySubtask,
    daily,
    weekly,
    monthly,
    activeVsCompleted,
    mostRecentProjects,
    topProjects
  }
}
