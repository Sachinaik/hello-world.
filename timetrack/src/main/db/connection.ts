import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
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
 * Opens (and if necessary creates) the SQLite database, applying pragmas and
 * running migrations. If the file exists but cannot be opened (locked or
 * corrupt), it is quarantined by renaming it aside and a fresh database is
 * created, so the app never fails to launch outright.
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

/** Quarantines a corrupt/unopenable database file so a fresh one can be created. */
export function quarantineDatabase(dbPath: string): string {
  const quarantinePath = `${dbPath}.corrupt-${Date.now()}`
  if (existsSync(dbPath)) {
    copyFileSync(dbPath, quarantinePath)
  }
  return quarantinePath
}

export function closeDatabase(): void {
  dbInstance?.close()
  dbInstance = null
}

export function getDb(): Database.Database {
  if (!dbInstance) throw new Error('Database has not been opened yet')
  return dbInstance
}
