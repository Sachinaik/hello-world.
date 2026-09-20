import { app, BrowserWindow, shell, dialog, globalShortcut, Menu } from 'electron'
import { join } from 'path'
import { existsSync, renameSync } from 'fs'
import { is } from './lib/env'
import { openDatabase, closeDatabase, getDbPath, DatabaseOpenError } from './db/connection'
import { registerIpcHandlers } from './ipc/registerHandlers'
import { ShortcutManager } from './services/shortcutManager'
import { initPowerMonitor } from './services/powerMonitorService'
import { recordHeartbeat } from './services/timerService'
import { buildAppMenu } from './menu'

const HEARTBEAT_INTERVAL_MS = 15_000

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/**
 * Opens the database, recovering from a locked or corrupt file by
 * quarantining it (renaming it aside, never deleting) and starting fresh —
 * the app must never fail to launch outright, and the user must always be
 * told in plain language what happened and where their old file went.
 */
function openDatabaseWithRecovery(): ReturnType<typeof openDatabase> {
  try {
    return openDatabase()
  } catch (err) {
    const dbPath = getDbPath()
    const message = err instanceof DatabaseOpenError ? err.message : String(err)

    const choice = dialog.showMessageBoxSync({
      type: 'error',
      title: 'TimeTrack could not open its database',
      message: 'TimeTrack could not open its database file.',
      detail:
        `${message}\n\nFile: ${dbPath}\n\n` +
        'This usually means the file is locked by another process or has become corrupted. ' +
        'You can move the problem file aside and start with a fresh, empty database — the old ' +
        'file will not be deleted, only renamed, so you can send it to us or inspect it later.',
      buttons: ['Move aside and start fresh', 'Quit'],
      defaultId: 0,
      cancelId: 1
    })

    if (choice !== 0) {
      app.quit()
      throw err
    }

    if (existsSync(dbPath)) {
      renameSync(dbPath, `${dbPath}.quarantined-${Date.now()}`)
    }
    for (const suffix of ['-wal', '-shm']) {
      const sidecarPath = `${dbPath}${suffix}`
      if (existsSync(sidecarPath)) renameSync(sidecarPath, `${sidecarPath}.quarantined-${Date.now()}`)
    }

    return openDatabase()
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildAppMenu())

  const db = openDatabaseWithRecovery()

  const shortcutManager = new ShortcutManager(db)
  registerIpcHandlers(db, shortcutManager)
  shortcutManager.reload()
  initPowerMonitor(db)

  const heartbeatTimer = setInterval(() => recordHeartbeat(db), HEARTBEAT_INTERVAL_MS)
  app.on('will-quit', () => clearInterval(heartbeatTimer))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  closeDatabase()
})
