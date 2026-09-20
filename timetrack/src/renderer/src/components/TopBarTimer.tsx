import { useState } from 'react'
import { formatClock } from '@shared/duration'
import { useActiveTimer } from '@renderer/hooks/useActiveTimer'
import { Tooltip } from './Tooltip'
import { ManualEntryDialog } from './ManualEntryDialog'

export function TopBarTimer(): JSX.Element {
  const { active, elapsedSeconds, lastActive } = useActiveTimer()
  const [showManualEntry, setShowManualEntry] = useState(false)

  if (!active) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
        <span>No timer running</span>
        {lastActive && (
          <Tooltip label={`Resume ${lastActive.projectName}${lastActive.subtaskTitle ? ` · ${lastActive.subtaskTitle}` : ''}`}>
            <button
              onClick={() => window.api.timer.resume(lastActive.projectId, lastActive.subtaskId)}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              ▶ Resume
            </button>
          </Tooltip>
        )}
        <Tooltip label="Log time after the fact">
          <button
            onClick={() => setShowManualEntry(true)}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            + Add time
          </button>
        </Tooltip>
        {showManualEntry && <ManualEntryDialog onClose={() => setShowManualEntry(false)} />}
      </div>
    )
  }

  const label = active.subtaskTitle ? `${active.projectName} · ${active.subtaskTitle}` : active.projectName

  return (
    <div className="flex items-center gap-3 rounded-lg bg-accent-50 px-3 py-1.5 dark:bg-accent-900/30">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-600" />
      </span>
      <span className="max-w-[220px] truncate text-sm font-medium text-slate-800 dark:text-slate-100" title={label}>
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums text-accent-700 dark:text-accent-300">
        {formatClock(elapsedSeconds)}
      </span>
      <div className="flex items-center gap-1">
        <Tooltip label="Pause">
          <button
            onClick={() => window.api.timer.pause()}
            aria-label="Pause timer"
            className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            ⏸
          </button>
        </Tooltip>
        <Tooltip label="Stop">
          <button
            onClick={() => window.api.timer.stop()}
            aria-label="Stop timer"
            className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
          >
            ⏹
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
