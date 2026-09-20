# TimeTrack

A local-first desktop time tracker for long-running professional work — research, writing, analysis, experiments. Everything lives in a single SQLite file on your machine. No accounts, no network calls, no telemetry.

Built with Electron, React, TypeScript, Vite (via `electron-vite`), `better-sqlite3`, and Tailwind CSS. Packaged with `electron-builder`. Tested with Vitest.

## Requirements

- Node.js 18+ (developed and tested on Node 22)
- macOS for building/packaging the final `.app` / `.dmg` (native `better-sqlite3` binaries and code signing require macOS; development can happen on any platform electron-vite supports)

## Installation

There are two ways to install TimeTrack on a Mac: as an **end user** (just want to run the app) or as a **developer** (want to build it from source).

### Option A — Install a pre-built app (end user)

If you already have a built `TimeTrack.dmg` or `TimeTrack-mac.zip` (from the `release/` folder, see [Package for macOS](#package-for-macos) below, or shared by someone else):

1. Double-click the `.dmg` file to mount it (or unzip the `.zip`).
2. Drag `TimeTrack.app` into your `Applications` folder.
3. Eject the mounted disk image.
4. Open `Applications` and double-click `TimeTrack.app` to launch it.

Because this build is unsigned/not notarized by default (no Apple Developer account configured), macOS Gatekeeper will block the first launch with a "cannot be opened" warning. To get past this **one time only**:

- Right-click (or Control-click) `TimeTrack.app` → **Open** → confirm **Open** in the dialog, or
- Go to **System Settings → Privacy & Security**, scroll to the Gatekeeper warning for TimeTrack, and click **Open Anyway**.

After that first approval, the app opens normally with a double-click from then on. The SQLite database file is created automatically on first launch (path shown later in the app's Settings page).

### Option B — Install from source (developer)

```bash
git clone https://github.com/Sachinaik/hello-world.git
cd hello-world/timetrack
npm install
```

`postinstall` runs `electron-builder install-app-deps`, which rebuilds `better-sqlite3` against Electron's Node ABI automatically. If you ever need to do this by hand (e.g. after switching Node versions, or if the native module gets out of sync), run:

```bash
npm run rebuild
```

which runs `electron-rebuild -f -w better-sqlite3` directly.

> **Why this matters:** `better-sqlite3` is a native addon. Electron bundles its own Node.js runtime with its own ABI version, which is usually different from your system Node's ABI. A module built for system Node will fail to load inside Electron (and vice versa) with a `NODE_MODULE_VERSION` mismatch error. `better-sqlite3` only ever runs in the **main process** — it is never imported by renderer or preload code.

## Run in development

```bash
npm run dev
```

This starts `electron-vite`'s dev server (with HMR for the renderer) and launches the Electron app pointed at it.

## Run tests

```bash
npm test
```

Because `better-sqlite3` is rebuilt against Electron's ABI, the Vitest suite is run through Electron's own Node runtime rather than your system Node, so the same native binary the app uses is the one the tests exercise. Watch mode: `npm run test:watch`. Type-check without emitting: `npm run typecheck`.

## Build

```bash
npm run build
```

Compiles the main process, preload script, and renderer into `out/`.

## Creating the .app on macOS

This turns the source code into a real double-clickable `TimeTrack.app` you (or anyone) can install using Option A above. **This step must be run on macOS** — `better-sqlite3`'s native binary is platform-specific, so a copy built on Linux/Windows will not launch on a real Mac.

1. Make sure dependencies are installed and native modules are rebuilt for Electron:
   ```bash
   npm install
   ```
2. Build and package a full, distributable app:
   ```bash
   npm run dist:mac
   ```
   This runs the production build, then `electron-builder --mac`, and writes both a `.dmg` and a `.zip` for Intel and Apple Silicon into the `release/` folder. This is the artifact you'd hand to Option A above.
3. Or, for a quick unpacked `.app` for local testing only (skips the DMG/zip step):
   ```bash
   npm run pack
   ```
   The resulting `TimeTrack.app` appears under `release/mac/` (or `release/mac-arm64/` on Apple Silicon) and can be launched directly or dragged into `Applications`.

Building a signed and notarized `.app` (so Gatekeeper doesn't warn at all) requires an Apple Developer Program membership and configuring `electron-builder`'s `mac.identity` / notarization options with your signing certificate. Without that, `npm run dist:mac` still produces a working, installable app — it's just unsigned, so the one-time Gatekeeper bypass in Option A is needed on first launch.

The app icon is generated automatically from `build/icon.png` (1024x1024, included) — `electron-builder` converts it to the required `.icns` during packaging.

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
        repo/                One file per aggregate: projects, subtasks, entries, tags, settings, dashboard, reports
      services/
        timerService.ts     Timer state machine: start/pause/resume/stop, heartbeat, crash recovery, sleep/suspend handling
        shortcutManager.ts   Global shortcut registration + rebinding + failure surfacing
        powerMonitorService.ts  Sleep/wake handling via Electron's powerMonitor
        dataManagement.ts    Backup, JSON export/import, restore-from-file
        seedData.ts          Demo data load/remove
      ipc/registerHandlers.ts  All ipcMain.handle() wiring
      menu.ts               Standard macOS app menu
      index.ts              App bootstrap: window, single-instance lock, DB-open error recovery
    preload/index.ts        contextBridge API — the ONLY thing exposed to the renderer
    renderer/                React app (Vite root)
      src/
        pages/               Dashboard, Projects, ProjectDetail, Reports, History, Settings
        components/          Dialogs, cards, top bar timer widget, charts
        hooks/               useActiveTimer, useTimerActions, useTheme
        lib/                 Small local data-fetching hook
    shared/                  Imported by BOTH main and renderer — the actual IPC contract
      types.ts              Domain types (Project, Subtask, TimeEntry, ...)
      ipc-contract.ts        The IpcApi interface + channel name constants
      duration.ts            The one duration-formatting function used everywhere
      localDate.ts            local_date derivation, week/month bucketing
  tests/                     Vitest specs
```

## Architecture notes

### The IPC boundary

`better-sqlite3` and all file-system access live exclusively in the main process. The preload script (`src/preload/index.ts`) is the only bridge, implementing the `IpcApi` interface from `src/shared/ipc-contract.ts`. Every window has `contextIsolation: true` and `nodeIntegration: false`, so the renderer has no path to Node or Electron internals except through that narrow, fully-typed surface.

All aggregation (totals, daily/weekly/monthly grouping, direct-vs-subtask time) happens in SQL in `src/main/db/repo/*.ts`. The renderer only renders already-computed numbers. Double-counting is structurally impossible: each time entry has exactly one `project_id` and at most one `subtask_id`.

### Timestamp strategy

Every timestamp (`started_at`, `ended_at`, `created_at`, ...) is stored as a UTC epoch millisecond `INTEGER`. Every time entry additionally stores `local_date` — a `YYYY-MM-DD` string computed once, at write time, from the local time zone (`src/shared/localDate.ts`). Reports group by this stored string, so history stays stable even if the system clock or time zone changes later. Sessions crossing midnight are attributed entirely to the start date and flagged in the history view.

### How active timers survive a crash

There is no in-memory elapsed-time accumulator. Pausing closes the current `time_entries` row immediately; resuming opens a new row. A partial unique index enforces at most one open (`ended_at IS NULL`) entry at a time. While running, the main process writes `last_heartbeat_at` every 15 seconds.

On startup, if an open entry exists, the app shows a recovery dialog with three choices: continue from now, close and stop (default), or pick an end time manually. `powerMonitor` handles sleep the same way — the open entry is closed at the suspend instant, and resuming asks whether to start fresh.

## Tests

`tests/` covers, with fixtures against a real in-memory SQLite database (not mocks):

- Duration formatting across boundary cases (0, under an hour, exactly an hour, double-digit hours)
- `local_date` derivation and stability under a simulated time-zone change
- Duration calculation for sessions crossing midnight
- The one-active-timer constraint, at both the service and schema level
- Crash recovery under all three recovery choices, including the no-heartbeat fallback
- Pause -> resume producing two entries whose durations sum correctly
- Project total = direct time + subtask time
- Deleting a subtask reassigning entries to project-level time with the total unchanged
- Manual entry creation, midnight-crossing attribution, and non-blocking overlap detection

## Data, backup, and privacy

- The database lives at `timetrack.sqlite3` (path shown in Settings), created automatically on first launch. WAL mode and `PRAGMA foreign_keys = ON` are set on every connection.
- Schema changes are versioned migrations tracked in a `schema_version` table; the app upgrades an older database in place without data loss.
- **Backup** copies the live database file (after a WAL checkpoint) into a `backups/` folder and reveals it in Finder.
- **Restore** replaces the live database with a chosen backup file, taking an automatic safety backup first, then relaunches to apply it.
- **JSON export/import** covers full portability between machines; import also takes an automatic safety backup first.
- **CSV export** is available per-project, filterable by date range from the project detail view.
- Nothing in this app makes a network request. There is no analytics, no telemetry, no accounts.
