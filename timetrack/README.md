# TimeTrack

A local-first desktop time tracker for long-running professional work — research, writing,
analysis, experiments. Everything lives in a single SQLite file on your machine. No accounts,
no network calls, no telemetry.

Built with Electron, React, TypeScript, Vite (via `electron-vite`), `better-sqlite3`, and
Tailwind CSS. Packaged with `electron-builder`. Tested with Vitest.

## Requirements

- Node.js 18+ (developed and tested on Node 22)
- macOS for building/packaging the final `.app` / `.dmg` (native `better-sqlite3` binaries and
  code signing require macOS; development can happen on any platform electron-vite supports)

## Install

```bash
npm install
```

`postinstall` runs `electron-builder install-app-deps`, which rebuilds `better-sqlite3` against
Electron's Node ABI automatically. If you ever need to do this by hand (e.g. after switching
Node versions, or if the native module gets out of sync), run:

```bash
npm run rebuild
```

which runs `electron-rebuild -f -w better-sqlite3` directly.

> **Why this matters:** `better-sqlite3` is a native addon. Electron bundles its own Node.js
> runtime with its own ABI version, which is usually different from your system Node's ABI. A
> module built for system Node will fail to load inside Electron (and vice versa) with an
> `NODE_MODULE_VERSION` mismatch error. `better-sqlite3` only ever runs in the **main process** —
> it is never imported by renderer or preload code.

## Run in development

```bash
npm run dev
```

This starts `electron-vite`'s dev server (with HMR for the renderer) and launches the Electron
app pointed at it.

## Run tests

```bash
npm test
```

Because `better-sqlite3` is rebuilt against Electron's ABI (see above), the Vitest suite is run
through Electron's own Node runtime rather than your system Node, so the same native binary the
app uses is the one the tests exercise:

```json
"test": "cross-env ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/dist/cli.js run"
```

You don't need to do anything differently — `npm test` handles this. Watch mode: `npm run test:watch`.

Type-check without emitting: `npm run typecheck`.

## Build

```bash
npm run build
```

Compiles the main process, preload script, and renderer into `out/`.

## Package for macOS

```bash
npm run dist:mac
```

This runs the production build and then `electron-builder --mac`, producing a `.dmg` and a `.zip`
for both Intel and Apple Silicon in `release/`. Building a signed, notarized artifact requires an
Apple Developer identity configured for `electron-builder` (see its
[code signing docs](https://www.electron.build/code-signing)); without one you'll get an unsigned
build suitable for local use and testing (Gatekeeper will warn on first launch — right-click →
Open to bypass, or sign it yourself).

To produce just an unpacked `.app` for quick local testing without going through the DMG/zip
steps:

```bash
npm run pack
```

### App icon

`build/icon.png` (1024×1024, included) is the source icon. `electron-builder` generates the
platform-specific `.icns` from it automatically during packaging — no extra step needed. If you
want to replace it, drop in a new 1024×1024 PNG at the same path (or design system icons per
platform under `build/` following [electron-builder's icon conventions](https://www.electron.build/icons)).

## Project layout

```
timetrack/
  electron.vite.config.ts   Vite config for main/preload/renderer
  electron-builder.yml      macOS packaging config
  tailwind.config.js
  src/
    main/                   Electron main process (Node — the only place better-sqlite3 loads)
      db/
        connection.ts       Opens the DB, applies pragmas, runs migrations, quarantine-on-corruption
        migrations/         Versioned, numbered migrations + the runner
        mappers.ts          snake_case DB rows -> camelCase domain types
        repo/                One file per aggregate: projects, subtasks, entries, tags,
                             settings, dashboard, reports — all SQL lives here
      services/
        timerService.ts      Pure-ish timer state machine: start/pause/resume/stop, heartbeat,
                             crash recovery, sleep/suspend handling — the most heavily tested file
        shortcutManager.ts   Global shortcut registration + rebinding + failure surfacing
        powerMonitorService.ts  Sleep/wake handling via Electron's powerMonitor
        dataManagement.ts    Backup, JSON export/import, restore-from-file
        seedData.ts          Demo data load/remove
      ipc/registerHandlers.ts All ipcMain.handle() wiring, one line per channel
      menu.ts                Standard macOS app menu
      index.ts                App bootstrap: window, single-instance lock, DB-open error recovery
    preload/index.ts         contextBridge API — the ONLY thing exposed to the renderer
    renderer/                React app (Vite root)
      src/
        pages/                Dashboard, Projects, ProjectDetail, Reports, History, Settings
        components/           Dialogs, cards, the top bar timer widget, charts
        hooks/                useActiveTimer, useTimerActions, useTheme
        lib/                  Small local data-fetching hook (no external query library)
    shared/                  Imported by BOTH main and renderer — the actual IPC contract
      types.ts               Domain types (Project, Subtask, TimeEntry, …) and computed shapes
      ipc-contract.ts         The IpcApi interface + channel name constants
      duration.ts             The one duration-formatting function used everywhere
      localDate.ts             local_date derivation, week/month bucketing — pure functions
  tests/                     Vitest specs (see below)
```

## Architecture notes

### The IPC boundary

`better-sqlite3` and all file-system access live exclusively in the main process. The preload
script (`src/preload/index.ts`) is the **only** bridge: it calls `contextBridge.exposeInMainWorld`
with a single `api` object that implements the `IpcApi` interface from `src/shared/ipc-contract.ts`.
Every window has `contextIsolation: true` and `nodeIntegration: false`, so the renderer has no
path to Node or Electron internals except through that narrow, fully-typed surface.

The same `IpcApi` type is imported by the preload script (to build the bridge) and by the
renderer (via `global.d.ts`, declaring `window.api: IpcApi`), so a method added to the interface
and forgotten on either side is a compile error, not a runtime `undefined is not a function`.
Request/response shapes live in `src/shared/types.ts` and are imported by both processes — there
is exactly one definition of what a `Project` or `TimeEntry` looks like.

All aggregation (totals, daily/weekly/monthly grouping, direct-vs-subtask time) happens in SQL in
`src/main/db/repo/*.ts`. The renderer only ever receives already-computed numbers and renders
them; it never sums `duration_seconds` itself. This is also why double-counting is structurally
impossible: a time entry has exactly one `project_id` and at most one `subtask_id`, direct time is
just the subset of entries with `subtask_id IS NULL`, and both are computed by the same query in
the same request — there is nothing to reconcile.

### Timestamp strategy

Every timestamp in the database (`started_at`, `ended_at`, `created_at`, …) is stored as a UTC
epoch millisecond `INTEGER`. Every time entry additionally stores `local_date` — a `YYYY-MM-DD`
string computed **once, at write time**, from the machine's local time zone at that instant
(`src/shared/localDate.ts`). All daily/weekly/monthly report queries group by this stored string
and never recompute it from the epoch value at query time.

That single decision is what keeps history and reports stable if the system clock changes or the
machine crosses a time zone later: a session logged while in one zone keeps the date it was logged
on, permanently, rather than silently shifting to a different day the next time a report is run. A
session that crosses midnight is not split — it is attributed entirely to its `local_date` (the
start date), and the history view flags this with a small "crosses midnight" note when an entry's
end date differs from its stored `local_date`.

### How active timers survive a crash

There is no in-memory "elapsed time" accumulator anywhere. Pausing a timer closes the current
`time_entries` row outright (`ended_at` and `duration_seconds` are written immediately); resuming
opens a brand new row against the same project/subtask. Every row in `time_entries` is therefore a
real, complete, independently-correctable work period — there is never a "partial" duration held
only in memory that a crash could lose.

At most one entry can have `ended_at IS NULL` at a time (a **partial unique index** on
`time_entries` enforces this at the schema level, not just in application code — see
`001_initial.ts`). While a timer is running, the main process writes `last_heartbeat_at = now()`
onto that open entry every 15 seconds (`recordHeartbeat` in `timerService.ts`, driven by a
`setInterval` in `main/index.ts`).

On startup, the app looks for an entry with `ended_at IS NULL`. If one exists, the app crashed (or
was killed) while a timer was running. The renderer shows a recovery dialog with both the original
start time and the last heartbeat, offering three choices — continue on the same item from now,
close and stop (the default), or pick an end time manually — all implemented by
`resolveCrashRecovery` in `timerService.ts`. If `last_heartbeat_at` is null, the crash happened
within the first 15 seconds, and the dialog says so explicitly, falling back to `started_at`.

Electron's `powerMonitor` is used the same way for sleep: on `suspend`, the open entry is closed at
the suspend instant immediately (sleep time is never silently counted as work); on `resume`, the
user is asked whether to start a fresh entry on the same item.

## Tests

`tests/` covers, with fixtures built against a real in-memory SQLite database (not mocks):

- Duration formatting across boundary cases (`0`, under an hour, exactly an hour, double-digit hours)
- `local_date` derivation and its stability under a simulated time-zone change
- Duration calculation for a session that crosses midnight
- The one-active-timer constraint, both at the service layer and at the raw schema level
- Crash recovery under all three recovery choices, including the no-heartbeat fallback
- Pause → resume producing two separate entries whose durations sum correctly
- Project total = direct time + subtask time, over a fixture with both
- Deleting a subtask reassigning its entries to project-level time with the project total unchanged
- Manual entry creation (start/end and duration-based), midnight-crossing attribution, and
  non-blocking overlap detection

## Data, backup, and privacy

- The database lives at `<Electron userData>/timetrack.sqlite3` (shown in Settings), created
  automatically on first launch. WAL mode and `PRAGMA foreign_keys = ON` are set on every
  connection.
- Schema changes are versioned migrations tracked in a `schema_version` table
  (`src/main/db/migrations/`); the app upgrades an older database in place without data loss.
- **Backup** copies the live database file (after a WAL checkpoint) into a `backups/` folder next
  to it and reveals it in Finder.
- **Restore** replaces the live database with a chosen backup file. The app takes an automatic
  safety backup of whatever is about to be overwritten first, then relaunches to apply it.
- **JSON export/import** covers the same data for full portability between machines; import also
  takes an automatic safety backup first.
- **CSV export** is available per-project, filterable by date range from the project detail view.
- Nothing in this app makes a network request. There is no analytics, no telemetry, no accounts.
