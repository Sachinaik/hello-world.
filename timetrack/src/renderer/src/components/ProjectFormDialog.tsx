import { useEffect, useState } from 'react'
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
  const [tagsText, setTagsText] = useState('')
  const [startDate, setStartDate] = useState(
    project?.startedAt ? new Date(project.startedAt).toISOString().slice(0, 10) : ''
  )
  const [completedDate, setCompletedDate] = useState(
    project?.completedAt ? new Date(project.completedAt).toISOString().slice(0, 10) : ''
  )
  const [saving, setSaving] = useState(false)

  function dateStringToEpoch(value: string): number | null {
    if (!value) return null
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d).getTime()
  }

  useEffect(() => {
    if (project) {
      window.api.tags.listForProject(project.id).then((tags) => setTagsText(tags.map((t) => t.name).join(', ')))
    }
  }, [project])

  async function saveTags(projectId: number): Promise<void> {
    const names = Array.from(
      new Set(
        tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      )
    )
    const tags = await Promise.all(names.map((name) => window.api.tags.create(name)))
    await window.api.tags.setForProject(
      projectId,
      tags.map((t) => t.id)
    )
  }

  async function handleSave(): Promise<void> {
    if (!name.trim()) return
    setSaving(true)
    try {
      let savedProjectId: number
      if (project) {
        await window.api.projects.update(project.id, {
          name: name.trim(),
          description: description || null,
          category: category || null,
          color,
          startedAt: dateStringToEpoch(startDate),
          completedAt: dateStringToEpoch(completedDate)
        })
        savedProjectId = project.id
        notify('Project updated')
      } else {
        const created = await window.api.projects.create({
          name: name.trim(),
          description: description || null,
          category: category || null,
          color,
          startedAt: dateStringToEpoch(startDate)
        })
        savedProjectId = created.id
        notify('Project created')
      }
      await saveTags(savedProjectId)
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
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Tags (optional)</span>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="e.g. grant, priority, collaborative"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <span className="mt-1 block text-xs text-slate-400">Comma-separated</span>
        </label>
        <div className="flex gap-3">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Start date (optional)</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
              Completion date (optional)
            </span>
            <input
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        </div>
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
