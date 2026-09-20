import type Database from 'better-sqlite3'
import type { Tag } from '@shared/types'
import { mapTag, type TagRow } from '../mappers'

export function listTags(db: Database.Database): Tag[] {
  const rows = db.prepare(`SELECT * FROM tags ORDER BY name COLLATE NOCASE`).all() as TagRow[]
  return rows.map(mapTag)
}

export function listTagsForProject(db: Database.Database, projectId: number): Tag[] {
  const rows = db
    .prepare(
      `SELECT t.* FROM tags t
       JOIN project_tags pt ON pt.tag_id = t.id
       WHERE pt.project_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(projectId) as TagRow[]
  return rows.map(mapTag)
}

export function createTag(db: Database.Database, name: string): Tag {
  const existing = db.prepare(`SELECT * FROM tags WHERE name = ?`).get(name) as TagRow | undefined
  if (existing) return mapTag(existing)
  const result = db.prepare(`INSERT INTO tags (name) VALUES (?)`).run(name)
  const row = db.prepare(`SELECT * FROM tags WHERE id = ?`).get(result.lastInsertRowid) as TagRow
  return mapTag(row)
}

export function setTagsForProject(db: Database.Database, projectId: number, tagIds: number[]): void {
  const run = db.transaction(() => {
    db.prepare(`DELETE FROM project_tags WHERE project_id = ?`).run(projectId)
    const insert = db.prepare(`INSERT INTO project_tags (project_id, tag_id) VALUES (?, ?)`)
    for (const tagId of tagIds) insert.run(projectId, tagId)
  })
  run()
}
