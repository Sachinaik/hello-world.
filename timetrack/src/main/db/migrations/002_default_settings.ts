import type Database from 'better-sqlite3'

export function up(db: Database.Database): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`
  )
  const defaults: [string, string][] = [
    ['theme', 'system'],
    ['shortcutStartPause', 'CommandOrControl+Control+Space'],
    ['shortcutStop', 'CommandOrControl+Control+.'],
    ['shortcutQuickAdd', 'CommandOrControl+K'],
    ['seedDataLoaded', 'false']
  ]
  const insertAll = db.transaction((rows: [string, string][]) => {
    for (const [key, value] of rows) insert.run(key, value)
  })
  insertAll(defaults)
}
