import type Database from 'better-sqlite3'
import { localDateFromEpoch } from '@shared/localDate'
import { getSetting, setSetting } from '../db/repo/settings'

interface SeedSubtask {
  title: string
  priority: 'low' | 'medium' | 'high'
  estimatedMinutes: number
  status: 'not_started' | 'in_progress' | 'completed'
}

interface SeedProject {
  name: string
  description: string
  category: string
  color: string
  subtasks: SeedSubtask[]
}

const DAY = 24 * 60 * 60 * 1000

const SEED_PROJECTS: SeedProject[] = [
  {
    name: 'MSCA Fellowship Proposal',
    description: 'Marie Skłodowska-Curie Actions fellowship application and supporting materials.',
    category: 'Grant writing',
    color: '#3c65f5',
    subtasks: [
      { title: 'Literature Review', priority: 'high', estimatedMinutes: 1200, status: 'completed' },
      { title: 'Research Objectives', priority: 'high', estimatedMinutes: 600, status: 'in_progress' },
      { title: 'Budget and Timeline', priority: 'medium', estimatedMinutes: 300, status: 'not_started' },
      { title: 'Supervisor Feedback Revisions', priority: 'medium', estimatedMinutes: 240, status: 'not_started' }
    ]
  },
  {
    name: 'Manuscript Revision',
    description: 'Addressing reviewer comments for the journal resubmission.',
    category: 'Writing',
    color: '#16a34a',
    subtasks: [
      { title: 'Reviewer Response Letter', priority: 'high', estimatedMinutes: 400, status: 'in_progress' },
      { title: 'Genome Analysis', priority: 'high', estimatedMinutes: 900, status: 'completed' },
      { title: 'Figure Preparation', priority: 'medium', estimatedMinutes: 300, status: 'not_started' }
    ]
  },
  {
    name: 'Bioinformatics Workflow',
    description: 'Reusable pipeline for genome QC, annotation, and phylogenomic analysis.',
    category: 'Research',
    color: '#d97706',
    subtasks: [
      { title: 'Genome Quality Control', priority: 'medium', estimatedMinutes: 500, status: 'completed' },
      { title: 'Annotation', priority: 'high', estimatedMinutes: 700, status: 'in_progress' },
      { title: 'Phylogenomic Analysis', priority: 'high', estimatedMinutes: 800, status: 'not_started' }
    ]
  }
]

function seededRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff
    return value / 0x7fffffff
  }
}

export function loadSeedData(db: Database.Database): void {
  if (getSetting(db, 'seedDataLoaded') === 'true') return

  const run = db.transaction(() => {
    const now = Date.now()
    const rand = seededRandom(42)

    for (const seedProject of SEED_PROJECTS) {
      const projectStart = now - 42 * DAY
      const projectResult = db
        .prepare(
          `INSERT INTO projects (name, description, status, color, category, started_at, created_at, updated_at)
           VALUES (?, ?, 'active', ?, ?, ?, ?, ?)`
        )
        .run(
          seedProject.name,
          seedProject.description,
          seedProject.color,
          seedProject.category,
          projectStart,
          projectStart,
          projectStart
        )
      const projectId = Number(projectResult.lastInsertRowid)

      const subtaskIds: number[] = []
      seedProject.subtasks.forEach((seedSubtask, index) => {
        const completedAt =
          seedSubtask.status === 'completed' ? now - Math.floor(rand() * 10) * DAY : null
        const result = db
          .prepare(
            `INSERT INTO subtasks
              (project_id, title, description, status, priority, estimated_minutes, position, completed_at, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            projectId,
            seedSubtask.title,
            seedSubtask.status,
            seedSubtask.priority,
            seedSubtask.estimatedMinutes,
            index,
            completedAt,
            projectStart,
            now
          )
        subtaskIds.push(Number(result.lastInsertRowid))
      })

      // Spread realistic sessions across the last six weeks so reports and
      // history have something meaningful to show.
      for (let dayOffset = 41; dayOffset >= 1; dayOffset--) {
        if (rand() > 0.45) continue // not every day has activity
        const sessionsToday = rand() > 0.7 ? 2 : 1
        for (let s = 0; s < sessionsToday; s++) {
          const dayStart = now - dayOffset * DAY
          const startHour = 9 + Math.floor(rand() * 8)
          const startedAt = new Date(dayStart).setHours(startHour, Math.floor(rand() * 60), 0, 0)
          const durationMinutes = 25 + Math.floor(rand() * 95)
          const endedAt = startedAt + durationMinutes * 60 * 1000
          const useSubtask = subtaskIds.length > 0 && rand() > 0.25
          const subtaskId = useSubtask ? subtaskIds[Math.floor(rand() * subtaskIds.length)] : null

          db.prepare(
            `INSERT INTO time_entries
              (project_id, subtask_id, started_at, ended_at, duration_seconds, local_date, entry_type, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'timer', ?, ?)`
          ).run(
            projectId,
            subtaskId,
            startedAt,
            endedAt,
            durationMinutes * 60,
            localDateFromEpoch(startedAt),
            startedAt,
            endedAt
          )
        }
      }
    }

    setSetting(db, 'seedDataLoaded', 'true')
  })
  run()
}

export function removeSeedData(db: Database.Database): void {
  const run = db.transaction(() => {
    const projectIds = db
      .prepare(`SELECT id FROM projects WHERE name IN (${SEED_PROJECTS.map(() => '?').join(',')})`)
      .all(...SEED_PROJECTS.map((p) => p.name)) as { id: number }[]

    for (const { id } of projectIds) {
      db.prepare(`DELETE FROM active_timer WHERE time_entry_id IN (SELECT id FROM time_entries WHERE project_id = ?)`).run(id)
      db.prepare(`DELETE FROM time_entries WHERE project_id = ?`).run(id)
      db.prepare(`DELETE FROM project_tags WHERE project_id = ?`).run(id)
      db.prepare(`DELETE FROM subtasks WHERE project_id = ?`).run(id)
      db.prepare(`DELETE FROM projects WHERE id = ?`).run(id)
    }

    setSetting(db, 'seedDataLoaded', 'false')
  })
  run()
}
