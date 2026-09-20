import { useState } from 'react'
import type { Priority, Subtask } from '@shared/types'
import { Modal } from './Modal'
import { useToast } from './Toast'

export function SubtaskFormDialog({
  projectId,
  subtask,
  onClose,
  onSaved
}: {
  projectId: number
  subtask?: Subtask
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const { notify } = useToast()
  const [title, setTitle] = useState(subtask?.title ?? '')
  const [description, setDescription] = useState(subtask?.description ?? '')
  const [priority, setPriority] = useState<Priority | ''>(subtask?.priority ?? '')
  const [estimatedMinutes, setEstimatedMinutes] = useState(subtask?.estimatedMinutes?.toString() ?? '')
  const [dueDate, setDueDate] = useState(subtask?.dueDate ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (!title.trim()) return
    setSaving(true)
    try {
      const patch = {
        title: title.trim(),
        description: description || null,
        priority: (priority || null) as Priority | null,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
        dueDate: dueDate || null
      }
      if (subtask) {
        await window.api.subtasks.update(subtask.id, patch)
        notify('Subtask updated')
      } else {
        await window.api.subtasks.create({ projectId, ...patch })
        notify('Subtask added')
      }
      onSaved()
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save subtask', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={subtask ? 'Edit subtask' : 'New subtask'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Title</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Description (optional)</span>
          <textarea
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority | '')}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Est. minutes</span>
            <input
              type="number"
              min={0}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Due date (optional)</span>
          <input
            type="date"
            value={dueDate ?? ''}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            disabled={!title.trim() || saving}
            onClick={handleSave}
            className="rounded-md bg-accent-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
          >
            {subtask ? 'Save changes' : 'Add subtask'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
