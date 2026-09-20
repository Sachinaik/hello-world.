import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { runMigrations } from './migrations'

export class DatabaseOpenError extends Error {
  constructor(
    public readonly dbPath: string,
    public readonly cause: unknown
  ) {
    super(`Could not open the TimeTrack database at ${dbPath}`)
    this.name = 'DatabaseOpenError'
  }
}

let dbInstance: Database.Database | null = null

export function getDbPath(): string {
  return join(app.getPath('userData'), 'timetrack.sqlite3')
}

/**
 * Opens (and if necessary creates) the SQLite database, applying pragmas
 * and running migrations. Throws DatabaseOpenError on failure (locked or
 * corrupt file) — the caller (main/index.ts) is responsible for the
 * quarantine-and-retry recovery flow and the user-facing dialog.
 */
export function openDatabase(): Database.Database {
  if (dbInstance) return dbInstance

  const dbPath = getDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })

  let db: Database.Database
  try {
    db = new Database(dbPath)
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
    runMigrations(db)
  } catch (err) {
    try {
      db!.close()
    } catch {
      /* already closed or never opened */
    }
    throw new DatabaseOpenError(dbPath, err)
  }

  dbInstance = db
  return db
}

export function closeDatabase(): void {
  dbInstance?.close()
  dbInstance = null
}

export function getDb(): Database.Database {
  if (!dbInstance) throw new Error('Database has not been opened yet')
  return dbInstance
}
