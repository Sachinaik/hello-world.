import type Database from 'better-sqlite3'
import type { AppSettingsMap } from '@shared/types'

export function getAllSettings(db: Database.Database): AppSettingsMap {
  const rows = db.prepare(`SELECT key, value FROM app_settings`).all() as { key: string; value: string }[]
  const map: Record<string, string> = {}
  for (const row of rows) map[row.key] = row.value
  return map as AppSettingsMap
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}
