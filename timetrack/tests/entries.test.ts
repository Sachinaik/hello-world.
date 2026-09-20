import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb } from './helpers/testDb'
import { createProject } from '@main/db/repo/projects'
import { createManualEntry, checkOverlap, updateEntry } from '@main/db/repo/entries'

describe('manual entries', () => {
  let db: Database.Database
  let projectId: number

  beforeEach(() => {
    db = createTestDb()
    projectId = createProject(db, { name: 'Manual Entry Project' }).id
  })

  it('creates an entry from start/end times and computes duration + local_date', () => {
    const entry = createManualEntry(db, {
      projectId,
      subtaskId: null,
      date: '2024-05-01',
      startTime: '09:00',
      endTime: '10:15'
    })
    expect(entry.durationSeconds).toBe(75 * 60)
    expect(entry.localDate).toBe('2024-05-01')
    expect(entry.entryType).toBe('manual')
  })

  it('attributes a session crossing midnight entirely to the start date', () => {
    const entry = createManualEntry(db, {
      projectId,
      subtaskId: null,
      date: '2024-05-01',
      startTime: '23:00',
      endTime: '01:30'
    })
    expect(entry.localDate).toBe('2024-05-01')
    expect(entry.durationSeconds).toBe(150 * 60)
  })

  it('creates an entry from a duration in hours and minutes', () => {
    const entry = createManualEntry(db, {
      projectId,
      subtaskId: null,
      date: '2024-05-01',
      durationMinutes: 90
    })
    expect(entry.durationSeconds).toBe(90 * 60)
  })

  it('detects and reports an overlapping entry without blocking the save', () => {
    createManualEntry(db, {
      projectId,
      subtaskId: null,
      date: '2024-05-01',
      startTime: '14:00',
      endTime: '15:30'
    })

    const newStart = new Date(2024, 4, 1, 15, 0).getTime()
    const newEnd = new Date(2024, 4, 1, 16, 0).getTime()
    const warning = checkOverlap(db, projectId, newStart, newEnd)

    expect(warning.overlapsWith).toHaveLength(1)

    // Overlap is informational only — the caller may still save.
    const entry = createManualEntry(db, {
      projectId,
      subtaskId: null,
      date: '2024-05-01',
      startTime: '15:00',
      endTime: '16:00'
    })
    expect(entry.id).toBeGreaterThan(0)
  })

  it('editing an entry recomputes duration_seconds and local_date', () => {
    const entry = createManualEntry(db, {
      projectId,
      subtaskId: null,
      date: '2024-05-01',
      startTime: '09:00',
      endTime: '10:00'
    })

    const newStart = new Date(2024, 4, 3, 8, 0).getTime()
    const newEnd = new Date(2024, 4, 3, 8, 45).getTime()
    const updated = updateEntry(db, { id: entry.id, startedAt: newStart, endedAt: newEnd })

    expect(updated.durationSeconds).toBe(45 * 60)
    expect(updated.localDate).toBe('2024-05-03')
  })
})
