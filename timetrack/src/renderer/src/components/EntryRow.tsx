import { useState } from 'react'
import type { TimeEntryWithNames } from '@shared/types'
import { formatDuration } from '@shared/duration'
import { EditEntryDialog } from './EditEntryDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'
import { Tooltip } from './Tooltip'

function formatTimeRange(entry: TimeEntryWithNames): string {
  const fmt = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return entry.endedAt ? `${fmt(entry.startedAt)} – ${fmt(entry.endedAt)}` : `${fmt(entry.startedAt)} – running`
}

export function EntryRow({
  entry,
  showProject,
  onChanged
}: {
  entry: TimeEntryWithNames
  showProject?: boolean
  onChanged: () => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { notify } = useToast()

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showProject && <span className="font-medium text-slate-800 dark:text-slate-100">{entry.projectName}</span>}
          {entry.subtaskTitle && (
            <span className="text-slate-500 dark:text-slate-400">{entry.subtaskTitle}</span>
          )}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              entry.entryType === 'manual'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {entry.entryType}
          </span>
          {entry.crossesMidnight && (
            <Tooltip label="This session ended on a different calendar day but is counted entirely on its start date">
              <span className="text-[10px] text-slate-400">↦ crosses midnight</span>
            </Tooltip>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{formatTimeRange(entry)}</p>
        {entry.note && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">"{entry.note}"</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {formatDuration(entry.durationSeconds ?? 0)}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-slate-400 hover:text-accent-600 dark:hover:text-accent-400"
        >
          Edit
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          className="text-xs text-slate-400 hover:text-red-600"
        >
          Delete
        </button>
      </div>

      {editing && <EditEntryDialog entry={entry} onClose={() => setEditing(false)} onSaved={onChanged} />}
      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this entry?"
          message="This permanently removes the time entry. This cannot be undone."
          danger
          confirmLabel="Delete"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={async () => {
            await window.api.entries.delete(entry.id)
            notify('Entry deleted')
            setConfirmingDelete(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}
