import { useEffect, useState } from 'react'
import type { ProjectWithTotals, SubtaskWithTotals } from '@shared/types'

export function ProjectSubtaskPicker({
  onStart,
  compact = false
}: {
  onStart: (projectId: number, subtaskId: number | null) => void
  compact?: boolean
}): JSX.Element {
  const [projects, setProjects] = useState<ProjectWithTotals[]>([])
  const [projectId, setProjectId] = useState<number | ''>('')
  const [subtasks, setSubtasks] = useState<SubtaskWithTotals[]>([])
  const [subtaskId, setSubtaskId] = useState<number | ''>('')

  useEffect(() => {
    window.api.projects.list({ status: 'active' }).then(setProjects)
  }, [])

  useEffect(() => {
    setSubtaskId('')
    if (projectId === '') {
      setSubtasks([])
      return
    }
    window.api.subtasks.listForProject(projectId).then((all) =>
      setSubtasks(all.filter((s) => s.status !== 'archived' && s.status !== 'completed'))
    )
  }, [projectId])

  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex flex-col gap-2 sm:flex-row'}>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="">Choose a project…</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        value={subtaskId}
        disabled={!projectId}
        onChange={(e) => setSubtaskId(e.target.value ? Number(e.target.value) : '')}
        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="">(Project-level time)</option>
        {subtasks.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      <button
        disabled={!projectId}
        onClick={() => projectId && onStart(projectId, subtaskId || null)}
        className="whitespace-nowrap rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ▶ Start timer
      </button>
    </div>
  )
}
