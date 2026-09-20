import type { Project, Subtask, Tag, TimeEntry } from '@shared/types'

// Raw shapes as returned by better-sqlite3 (snake_case columns).

export interface ProjectRow {
  id: number
  name: string
  description: string | null
  status: string
  color: string | null
  category: string | null
  started_at: number | null
  completed_at: number | null
  archived_at: number | null
  deleted: number
  created_at: number
  updated_at: number
}

export interface SubtaskRow {
  id: number
  project_id: number
  title: string
  description: string | null
  status: string
  priority: string | null
  estimated_minutes: number | null
  due_date: string | null
  completed_at: number | null
  position: number
  created_at: number
  updated_at: number
}

export interface TimeEntryRow {
  id: number
  project_id: number
  subtask_id: number | null
  started_at: number
  ended_at: number | null
  duration_seconds: number | null
  local_date: string
  entry_type: string
  note: string | null
  last_heartbeat_at: number | null
  created_at: number
  updated_at: number
}

export interface TagRow {
  id: number
  name: string
}

export function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as Project['status'],
    color: row.color,
    category: row.category,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
    deleted: (row.deleted ? 1 : 0) as 0 | 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function mapSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status as Subtask['status'],
    priority: row.priority as Subtask['priority'],
    estimatedMinutes: row.estimated_minutes,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function mapTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    subtaskId: row.subtask_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    localDate: row.local_date,
    entryType: row.entry_type as TimeEntry['entryType'],
    note: row.note,
    lastHeartbeatAt: row.last_heartbeat_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function mapTag(row: TagRow): Tag {
  return { id: row.id, name: row.name }
}
