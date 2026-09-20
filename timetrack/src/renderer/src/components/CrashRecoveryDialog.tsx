import { useState } from 'react'
import type { CrashRecoveryInfo } from '@shared/types'
import { Modal } from './Modal'
import { formatClock } from '@shared/duration'

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString([], {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function CrashRecoveryDialog({
  info,
  onResolved
}: {
  info: CrashRecoveryInfo
  onResolved: () => void
}): JSX.Element {
  const [manualEnd, setManualEnd] = useState(() => {
    const anchor = info.entry.lastHeartbeatAt ?? info.entry.startedAt
    const d = new Date(anchor)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  const [showManualPicker, setShowManualPicker] = useState(false)

  const anchor = info.entry.lastHeartbeatAt ?? info.entry.startedAt
  const label = info.subtaskTitle ? `${info.projectName} · ${info.subtaskTitle}` : info.projectName
  const elapsed = Math.max(0, Math.round((anchor - info.entry.startedAt) / 1000))

  async function resolve(action: 'closeAndContinue' | 'closeAndStop'): Promise<void> {
    await window.api.timer.resolveCrashRecovery({ action })
    onResolved()
  }

  async function resolveManual(): Promise<void> {
    const base = new Date(info.entry.startedAt)
    const [h, m] = manualEnd.split(':').map(Number)
    const endedAt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m).getTime()
    await window.api.timer.resolveCrashRecovery({ action: 'closeAndEditManually', endedAt })
    onResolved()
  }

  return (
    <Modal title="TimeTrack didn't close cleanly last time" onClose={() => resolve('closeAndStop')}>
      <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
        <p>
          A timer was still running for <strong className="text-slate-900 dark:text-slate-100">{label}</strong>{' '}
          when the app last stopped.
        </p>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-slate-700/50">
          <div>Started: {formatTime(info.entry.startedAt)}</div>
          <div>
            {info.usedFallbackToStartedAt ? 'No heartbeat recorded (crashed within 15s of starting)' : 'Last heartbeat'}
            : {formatTime(anchor)}
          </div>
          <div>Elapsed at that point: {formatClock(elapsed)}</div>
        </div>

        {!showManualPicker ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => resolve('closeAndContinue')}
              className="rounded-md border border-slate-200 px-3 py-2 text-left font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              Close the entry at {formatTime(anchor)} and start a new one now, continuing this item
            </button>
            <button
              onClick={() => resolve('closeAndStop')}
              className="rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-left font-medium text-accent-800 hover:bg-accent-100 dark:border-accent-700 dark:bg-accent-900/30 dark:text-accent-200"
            >
              Close the entry at {formatTime(anchor)} and stop (recommended)
            </button>
            <button
              onClick={() => setShowManualPicker(true)}
              className="rounded-md border border-slate-200 px-3 py-2 text-left font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              Set the end time manually…
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">End time</span>
              <input
                type="time"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowManualPicker(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
              >
                Back
              </button>
              <button
                onClick={resolveManual}
                className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-700"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
