import { useEffect, useMemo, useState } from 'react'
import type { ProjectWithTotals, SubtaskWithTotals } from '@shared/types'
import { Modal } from './Modal'
import { useTimerActions } from '@renderer/hooks/useTimerActions'

interface FlatItem {
  projectId: number
  subtaskId: number | null
  projectName: string
  subtaskTitle: string | null
}

export function QuickAddDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<FlatItem[]>([])
  const { startTimer, conflictDialog } = useTimerActions()

  useEffect(() => {
    window.api.projects.list({ status: 'active' }).then(async (projects: ProjectWithTotals[]) => {
      const flat: FlatItem[] = []
      for (const p of projects) {
        flat.push({ projectId: p.id, subtaskId: null, projectName: p.name, subtaskTitle: null })
        const subtasks: SubtaskWithTotals[] = await window.api.subtasks.listForProject(p.id)
        for (const s of subtasks) {
          if (s.status === 'archived') continue
          flat.push({ projectId: p.id, subtaskId: s.id, projectName: p.name, subtaskTitle: s.title })
        }
      }
      setItems(flat)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 8)
    return items
      .filter(
        (i) => i.projectName.toLowerCase().includes(q) || (i.subtaskTitle ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [items, query])

  function pick(item: FlatItem): void {
    startTimer(item.projectId, item.subtaskId)
    onClose()
  }

  return (
    <Modal title="Quick add" onClose={onClose} width="sm">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search projects and subtasks…"
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-slate-600 dark:bg-slate-800"
      />
      <ul className="mt-2 max-h-72 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-slate-400">No matches</li>
        )}
        {filtered.map((item) => (
          <li key={`${item.projectId}-${item.subtaskId ?? 'p'}`}>
            <button
              onClick={() => pick(item)}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{item.projectName}</span>
                {item.subtaskTitle && (
                  <span className="text-slate-500 dark:text-slate-400"> · {item.subtaskTitle}</span>
                )}
              </span>
              <span className="text-xs text-accent-600 dark:text-accent-400">Start ▶</span>
            </button>
          </li>
        ))}
      </ul>
      {conflictDialog}
    </Modal>
  )
}
