import type Database from 'better-sqlite3'

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK (status IN ('active','completed','archived')) DEFAULT 'active',
      color TEXT,
      category TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      archived_at INTEGER,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE subtasks (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK (status IN ('not_started','in_progress','completed','archived')) DEFAULT 'not_started',
      priority TEXT CHECK (priority IN ('low','medium','high')),
      estimated_minutes INTEGER,
      due_date TEXT,
      completed_at INTEGER,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE time_entries (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      subtask_id INTEGER REFERENCES subtasks(id),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_seconds INTEGER,
      local_date TEXT NOT NULL,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('timer','manual')),
      note TEXT,
      last_heartbeat_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE active_timer (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      time_entry_id INTEGER NOT NULL REFERENCES time_entries(id)
    );

    CREATE TABLE tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE project_tags (
      project_id INTEGER NOT NULL REFERENCES projects(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      PRIMARY KEY (project_id, tag_id)
    );

    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
    CREATE INDEX idx_time_entries_subtask_id ON time_entries(subtask_id);
    CREATE INDEX idx_time_entries_local_date ON time_entries(local_date);
    CREATE INDEX idx_subtasks_project_id ON subtasks(project_id);

    -- Only one open entry (ended_at IS NULL) may exist at a time. This is
    -- the database-level guarantee the spec requires: starting a second
    -- timer while one is running must be impossible, not merely prevented
    -- in the UI.
    CREATE UNIQUE INDEX idx_time_entries_one_open
      ON time_entries(entry_type)
      WHERE ended_at IS NULL AND entry_type = 'timer';
  `)
}
