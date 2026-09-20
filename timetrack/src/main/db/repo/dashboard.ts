import type Database from 'better-sqlite3'
import type { DashboardSummary } from '@shared/types'
import { listProjects } from './projects'
import { getActiveTimer } from '../../services/timerService'
import { currentLocalDateRange } from './dateRanges'
import { addDaysToLocalDate, todayLocalDate } from '@shared/localDate'

export function getDashboardSummary(db: Database.Database): DashboardSummary {
  const { today, weekStart } = currentLocalDateRange()

  const todaySeconds = (
    db.prepare(`SELECT COALESCE(SUM(duration_seconds), 0) as s FROM time_entries WHERE local_date = ?`).get(
      today
    ) as { s: number }
  ).s

  const weekSeconds = (
    db
      .prepare(`SELECT COALESCE(SUM(duration_seconds), 0) as s FROM time_entries WHERE local_date >= ?`)
      .get(weekStart) as { s: number }
  ).s

  const activeProjects = listProjects(db, { status: 'active' })

  const recentProjects = [...activeProjects]
    .filter((p) => p.totals.lastWorkedLocalDate)
    .sort((a, b) => (b.totals.lastWorkedLocalDate ?? '').localeCompare(a.totals.lastWorkedLocalDate ?? ''))
    .slice(0, 5)

  const topProjects = [...activeProjects].sort((a, b) => b.totals.totalSeconds - a.totals.totalSeconds).slice(0, 5)

  const sevenDayStart = addDaysToLocalDate(todayLocalDate(), -6)
  const dailyRows = db
    .prepare(
      `SELECT local_date, COALESCE(SUM(duration_seconds), 0) as total
       FROM time_entries WHERE local_date >= ? GROUP BY local_date`
    )
    .all(sevenDayStart) as { local_date: string; total: number }[]
  const dailyMap = new Map(dailyRows.map((r) => [r.local_date, r.total]))
  const sevenDaySummary = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToLocalDate(sevenDayStart, i)
    return { localDate: date, totalSeconds: dailyMap.get(date) ?? 0 }
  })

  const running = getActiveTimer(db)

  return {
    todaySeconds,
    weekSeconds,
    activeProjectCount: activeProjects.length,
    recentProjects,
    topProjects,
    sevenDaySummary,
    activeProjects,
    runningTimer: running
      ? {
          entry: running.entry,
          projectName: running.projectName,
          subtaskTitle: running.subtaskTitle,
          projectColor:
            (db.prepare(`SELECT color FROM projects WHERE id = ?`).get(running.entry.projectId) as
              | { color: string | null }
              | undefined)?.color ?? null
        }
      : null
  }
}
