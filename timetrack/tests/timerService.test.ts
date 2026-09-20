import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb } from './helpers/testDb'
import {
  computeDurationSeconds,
  startTimer,
  confirmSwitchAndStart,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getActiveTimer,
  getCrashRecoveryInfo,
  resolveCrashRecovery,
  closeAtSuspend
} from '@main/services/timerService'

function insertProject(db: Database.Database, name = 'Test Project'): number {
  const now = Date.now()
  const result = db
    .prepare(
      `INSERT INTO projects (name, status, created_at, updated_at) VALUES (?, 'active', ?, ?)`
    )
    .run(name, now, now)
  return Number(result.lastInsertRowid)
}

describe('computeDurationSeconds', () => {
  it('computes duration for a simple same-day session', () => {
    const start = new Date(2024, 4, 1, 9, 0, 0).getTime()
    const end = new Date(2024, 4, 1, 10, 30, 0).getTime()
    expect(computeDurationSeconds(start, end)).toBe(90 * 60)
  })

  it('computes duration correctly for a session crossing midnight', () => {
    const start = new Date(2024, 4, 1, 23, 0, 0).getTime()
    const end = new Date(2024, 4, 2, 1, 30, 0).getTime()
    expect(computeDurationSeconds(start, end)).toBe(150 * 60)
  })
})

describe('timer service — one active timer constraint', () => {
  let db: Database.Database
  let projectId: number

  beforeEach(() => {
    db = createTestDb()
    projectId = insertProject(db)
  })

  it('starts a timer when none is running', () => {
    const result = startTimer(db, projectId, null, 1000)
    expect('entry' in result).toBe(true)
  })

  it('rejects a second concurrent start and reports the conflict', () => {
    startTimer(db, projectId, null, 1000)
    const second = startTimer(db, projectId, null, 2000)
    expect('conflict' in second).toBe(true)
    if ('conflict' in second) {
      expect(second.conflict.projectName).toBe('Test Project')
    }
  })

  it('the schema itself rejects a second open timer entry even bypassing the service check', () => {
    startTimer(db, projectId, null, 1000)
    expect(() => {
      db.prepare(
        `INSERT INTO time_entries (project_id, started_at, local_date, entry_type, created_at, updated_at)
         VALUES (?, ?, '2024-01-01', 'timer', ?, ?)`
      ).run(projectId, 2000, 2000, 2000)
    }).toThrow()
  })

  it('confirmSwitchAndStart closes the running entry and starts a new one atomically', () => {
    const other = insertProject(db, 'Other project')
    startTimer(db, projectId, null, 1000)
    const newEntry = confirmSwitchAndStart(db, other, null, 5000)
    expect(newEntry.projectId).toBe(other)

    const active = getActiveTimer(db)
    expect(active?.entry.id).toBe(newEntry.id)

    const closedEntry = db
      .prepare(`SELECT * FROM time_entries WHERE project_id = ?`)
      .get(projectId) as { ended_at: number; duration_seconds: number }
    expect(closedEntry.ended_at).toBe(5000)
    expect(closedEntry.duration_seconds).toBe(4) // (5000-1000)/1000 rounded
  })
})

describe('timer service — pause and resume', () => {
  let db: Database.Database
  let projectId: number

  beforeEach(() => {
    db = createTestDb()
    projectId = insertProject(db)
  })

  it('pause then resume produces two separate entries whose durations sum correctly', () => {
    const start = Date.parse('2024-05-01T09:00:00')
    startTimer(db, projectId, null, start)

    const pauseAt = start + 20 * 60 * 1000 // worked 20 min
    pauseTimer(db, pauseAt)

    expect(getActiveTimer(db)).toBeNull()

    const resumeAt = pauseAt + 10 * 60 * 1000 // 10 min break, uncounted
    resumeTimer(db, projectId, null, resumeAt)

    const stopAt = resumeAt + 15 * 60 * 1000 // worked another 15 min
    stopTimer(db, stopAt)

    const entries = db
      .prepare(`SELECT duration_seconds FROM time_entries WHERE project_id = ? ORDER BY started_at`)
      .all(projectId) as { duration_seconds: number }[]

    expect(entries).toHaveLength(2)
    expect(entries[0].duration_seconds).toBe(20 * 60)
    expect(entries[1].duration_seconds).toBe(15 * 60)

    const totalSeconds = entries.reduce((sum, e) => sum + e.duration_seconds, 0)
    expect(totalSeconds).toBe(35 * 60)
  })
})

describe('timer service — crash recovery', () => {
  let db: Database.Database
  let projectId: number
  const started = Date.parse('2024-05-01T09:00:00')
  const heartbeat = started + 45 * 60 * 1000

  beforeEach(() => {
    db = createTestDb()
    projectId = insertProject(db)
    db.prepare(
      `INSERT INTO time_entries
        (project_id, started_at, local_date, entry_type, last_heartbeat_at, created_at, updated_at)
       VALUES (?, ?, '2024-05-01', 'timer', ?, ?, ?)`
    ).run(projectId, started, heartbeat, started, started)
  })

  it('reports the open entry with the last heartbeat', () => {
    const info = getCrashRecoveryInfo(db)
    expect(info).not.toBeNull()
    expect(info?.entry.lastHeartbeatAt).toBe(heartbeat)
    expect(info?.usedFallbackToStartedAt).toBe(false)
  })

  it('falls back to started_at when there is no heartbeat (crash within first 15s)', () => {
    db.exec('DELETE FROM time_entries')
    db.prepare(
      `INSERT INTO time_entries (project_id, started_at, local_date, entry_type, created_at, updated_at)
       VALUES (?, ?, '2024-05-01', 'timer', ?, ?)`
    ).run(projectId, started, started, started)

    const info = getCrashRecoveryInfo(db)
    expect(info?.usedFallbackToStartedAt).toBe(true)
    expect(info?.entry.lastHeartbeatAt).toBeNull()
  })

  it('choice 1: closes at heartbeat and opens a fresh entry continuing the same item', () => {
    const now = heartbeat + 5 * 60 * 1000
    resolveCrashRecovery(db, { action: 'closeAndContinue' }, now)

    const closed = db
      .prepare(`SELECT * FROM time_entries WHERE ended_at IS NOT NULL`)
      .get() as { ended_at: number; duration_seconds: number }
    expect(closed.ended_at).toBe(heartbeat)
    expect(closed.duration_seconds).toBe(45 * 60)

    const active = getActiveTimer(db)
    expect(active).not.toBeNull()
    expect(active?.entry.startedAt).toBe(now)
    expect(active?.entry.projectId).toBe(projectId)
  })

  it('choice 2 (default): closes at heartbeat and stops, nothing left running', () => {
    resolveCrashRecovery(db, { action: 'closeAndStop' })

    expect(getActiveTimer(db)).toBeNull()
    const closed = db
      .prepare(`SELECT * FROM time_entries`)
      .get() as { ended_at: number; duration_seconds: number }
    expect(closed.ended_at).toBe(heartbeat)
    expect(closed.duration_seconds).toBe(45 * 60)
  })

  it('choice 3: closes at a manually chosen end time', () => {
    const manualEnd = started + 30 * 60 * 1000
    resolveCrashRecovery(db, { action: 'closeAndEditManually', endedAt: manualEnd })

    expect(getActiveTimer(db)).toBeNull()
    const closed = db
      .prepare(`SELECT * FROM time_entries`)
      .get() as { ended_at: number; duration_seconds: number }
    expect(closed.ended_at).toBe(manualEnd)
    expect(closed.duration_seconds).toBe(30 * 60)
  })
})

describe('timer service — sleep/suspend', () => {
  it('closes the open entry at the suspend timestamp', () => {
    const db = createTestDb()
    const projectId = insertProject(db)
    const start = Date.parse('2024-05-01T09:00:00')
    startTimer(db, projectId, null, start)

    const suspendedAt = start + 25 * 60 * 1000
    const closed = closeAtSuspend(db, suspendedAt)

    expect(closed?.endedAt).toBe(suspendedAt)
    expect(closed?.durationSeconds).toBe(25 * 60)
    expect(getActiveTimer(db)).toBeNull()
  })

  it('is a no-op when nothing is running', () => {
    const db = createTestDb()
    expect(closeAtSuspend(db, Date.now())).toBeNull()
  })
})
