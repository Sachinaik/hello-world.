import { useState } from 'react'
import type { Project } from '@shared/types'
import { Modal } from './Modal'
import { useToast } from './Toast'

const COLOR_OPTIONS = ['#3c65f5', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#64748b']

export function ProjectFormDialog({
  project,
  onClose,
  onSaved
}: {
  project?: Project
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const { notify } = useToast()
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [category, setCategory] = useState(project?.category ?? '')
  const [color, setColor] = useState(project?.color ?? COLOR_OPTIONS[0])
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (project) {
        await window.api.projects.update(project.id, {
          name: name.trim(),
          description: description || null,
          category: category || null,
          color
        })
        notify('Project updated')
      } else {
        await window.api.projects.create({
          name: name.trim(),
          description: description || null,
          category: category || null,
          color
        })
        notify('Project created')
      }
      onSaved()
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save project', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Category (optional)</span>
          <input
            value={category ?? ''}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Grant writing, Research"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Color</span>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Choose color ${c}`}
                className={`h-6 w-6 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || saving}
            onClick={handleSave}
            className="rounded-md bg-accent-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
          >
            {project ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
