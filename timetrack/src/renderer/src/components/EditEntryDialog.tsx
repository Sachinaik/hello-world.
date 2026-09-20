import { useState } from 'react'
import type { TimeEntryWithNames } from '@shared/types'
import { Modal } from './Modal'
import { useToast } from './Toast'

function toLocalInputValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EditEntryDialog({
  entry,
  onClose,
  onSaved
}: {
  entry: TimeEntryWithNames
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const { notify } = useToast()
  const [start, setStart] = useState(toLocalInputValue(entry.startedAt))
  const [end, setEnd] = useState(entry.endedAt ? toLocalInputValue(entry.endedAt) : toLocalInputValue(Date.now()))
  const [note, setNote] = useState(entry.note ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      const startedAt = new Date(start).getTime()
      const endedAt = new Date(end).getTime()
      await window.api.entries.update({ id: entry.id, startedAt, endedAt, note: note || null })
      notify('Entry updated')
      onSaved()
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save entry', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Edit entry — ${entry.projectName}${entry.subtaskTitle ? ` · ${entry.subtaskTitle}` : ''}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Start</span>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">End</span>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="rounded-md bg-accent-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>
    </Modal>
  )
}
