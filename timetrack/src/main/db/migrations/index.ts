import type Database from 'better-sqlite3'
import { up as up001 } from './001_initial'
import { up as up002 } from './002_default_settings'

interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

// Add new migrations to the end of this list. Each one runs exactly once,
// in order, inside its own transaction, tracked by the schema_version
// table below — this is how the app upgrades an older database in place
// without losing data.
const MIGRATIONS: Migration[] = [
  { version: 1, name: 'initial', up: up001 },
  { version: 2, name: 'default_settings', up: up002 }
]

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `)

  const currentRow = db
    .prepare(`SELECT MAX(version) as version FROM schema_version`)
    .get() as { version: number | null }
  const currentVersion = currentRow.version ?? 0

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  )

  for (const migration of pending) {
    const apply = db.transaction(() => {
      migration.up(db)
      db.prepare(`INSERT INTO schema_version (version, applied_at) VALUES (?, ?)`).run(
        migration.version,
        Date.now()
      )
    })
    apply()
  }
}
