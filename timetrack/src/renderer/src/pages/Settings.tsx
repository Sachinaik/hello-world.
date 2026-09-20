import { useEffect, useState } from 'react'
import type { AppSettingsMap } from '@shared/types'
import { useTheme } from '@renderer/hooks/useTheme'
import { useToast } from '@renderer/components/Toast'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function Settings(): JSX.Element {
  const { theme, setTheme } = useTheme()
  const { notify } = useToast()

  const [settings, setSettings] = useState<AppSettingsMap | null>(null)
  const [shortcutErrors, setShortcutErrors] = useState<string[]>([])
  const [dbPath, setDbPath] = useState('')
  const [seedLoaded, setSeedLoaded] = useState(false)
  const [pendingRestorePath, setPendingRestorePath] = useState<string | null>(null)
  const [confirmingImport, setConfirmingImport] = useState<File | null>(null)

  function reload(): void {
    window.api.settings.getAll().then((s) => {
      setSettings(s)
      setSeedLoaded(s.seedDataLoaded === 'true')
    })
    window.api.shortcuts.getRegistrationErrors().then(setShortcutErrors)
    window.api.data.getDbPath().then(setDbPath)
  }

  useEffect(reload, [])

  async function handleBackup(): Promise<void> {
    const result = await window.api.data.backupDatabase()
    notify(`Backup saved to ${result.filePath}`)
  }

  async function handleExportJson(): Promise<void> {
    const payload = await window.api.data.exportJson()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timetrack-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify('JSON export downloaded')
  }

  async function handlePickRestoreFile(): Promise<void> {
    const path = await window.api.data.pickRestoreFile()
    if (path) setPendingRestorePath(path)
  }

  async function handleConfirmRestore(): Promise<void> {
    if (!pendingRestorePath) return
    await window.api.data.restoreFromFile(pendingRestorePath)
    // App relaunches automatically after this call.
  }

  function handleImportFileChosen(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (file) setConfirmingImport(file)
    e.target.value = ''
  }

  async function handleConfirmImport(): Promise<void> {
    if (!confirmingImport) return
    const text = await confirmingImport.text()
    try {
      const payload = JSON.parse(text)
      await window.api.data.importJson(payload)
      notify('Data imported successfully')
      reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not import file', 'error')
    } finally {
      setConfirmingImport(null)
    }
  }

  async function handleShortcutChange(key: string, value: string): Promise<void> {
    await window.api.settings.set(key, value)
    reload()
  }

  async function toggleSeedData(): Promise<void> {
    if (seedLoaded) {
      await window.api.data.removeSeedData()
      notify('Demo data removed')
    } else {
      await window.api.data.loadSeedData()
      notify('Demo data loaded')
    }
    reload()
  }

  if (!settings) return <div className="p-6 text-sm text-slate-400">Loading…</div>

  return (
    <div className="flex max-w-3xl flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400 dark:text-slate-500">Appearance, shortcuts, and your data.</p>
      </div>

      <SectionCard title="Appearance">
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                theme === t
                  ? 'bg-accent-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Keyboard shortcuts"
        description="Start/pause and stop work system-wide. Quick add (Cmd+K) only works while TimeTrack is focused."
      >
        {shortcutErrors.length > 0 && (
          <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            {shortcutErrors.map((err) => (
              <p key={err}>⚠ {err}</p>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">Start / pause timer</span>
            <input
              defaultValue={settings.shortcutStartPause}
              onBlur={(e) => handleShortcutChange('shortcutStartPause', e.target.value)}
              className="w-56 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">Stop timer</span>
            <input
              defaultValue={settings.shortcutStop}
              onBlur={(e) => handleShortcutChange('shortcutStop', e.target.value)}
              className="w-56 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">Quick add</span>
            <input
              defaultValue={settings.shortcutQuickAdd}
              disabled
              title="In-window shortcut, not rebindable yet"
              className="w-56 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-400 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Demo data" description="Load realistic sample projects to explore the app.">
        <button
          onClick={toggleSeedData}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {seedLoaded ? 'Remove demo data' : 'Load demo data'}
        </button>
      </SectionCard>

      <SectionCard
        title="Backup & restore"
        description="Everything lives in one local file — no network calls, no accounts."
      >
        <p className="mb-3 break-all text-xs text-slate-400 dark:text-slate-500">Database file: {dbPath}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBackup}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Back up database file
          </button>
          <button
            onClick={handleExportJson}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Export as JSON
          </button>
          <label className="cursor-pointer rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
            Import JSON…
            <input type="file" accept="application/json" className="hidden" onChange={handleImportFileChosen} />
          </label>
          <button
            onClick={handlePickRestoreFile}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20"
          >
            Restore from backup file…
          </button>
        </div>
      </SectionCard>

      {pendingRestorePath && (
        <ConfirmDialog
          title="Restore database from backup?"
          message={
            <>
              This will replace your current database with <strong>{pendingRestorePath}</strong>. Your current
              data will be safely backed up first, but everything you've entered since that backup was made
              will be gone. TimeTrack will restart to apply the restore.
            </>
          }
          danger
          confirmLabel="Restore and restart"
          onCancel={() => setPendingRestorePath(null)}
          onConfirm={handleConfirmRestore}
        />
      )}

      {confirmingImport && (
        <ConfirmDialog
          title="Import data from JSON?"
          message={
            <>
              This will replace all projects, subtasks, and time entries with the contents of{' '}
              <strong>{confirmingImport.name}</strong>. Your current data will be backed up automatically
              before it's overwritten.
            </>
          }
          danger
          confirmLabel="Import and replace"
          onCancel={() => setConfirmingImport(null)}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
  )
}
