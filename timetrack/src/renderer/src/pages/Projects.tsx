import { useState } from 'react'
import type { ProjectStatus } from '@shared/types'
import { useAsync } from '@renderer/lib/queryClient'
import { ProjectCard } from '@renderer/components/ProjectCard'
import { EmptyState } from '@renderer/components/EmptyState'
import { ProjectFormDialog } from '@renderer/components/ProjectFormDialog'
import { useTimerActions } from '@renderer/hooks/useTimerActions'

const TABS: { label: string; value: ProjectStatus | 'all' }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Archived', value: 'archived' },
  { label: 'All', value: 'all' }
]

export function Projects(): JSX.Element {
  const [status, setStatus] = useState<ProjectStatus | 'all'>('active')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const { startTimer, conflictDialog } = useTimerActions()

  const { data: projects, loading, reload } = useAsync(
    () => window.api.projects.list({ status: status === 'all' ? undefined : status, search: search || undefined }),
    [status, search]
  )

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Projects</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">Manage what you're working on.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
        >
          + New project
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab.value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="w-64 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          title={search ? 'No projects match your search' : `No ${status === 'all' ? '' : status} projects`}
          description={
            search
              ? 'Try a different search term.'
              : "Projects you create will show up here — start by adding your first one."
          }
          action={
            !search && (
              <button
                onClick={() => setShowForm(true)}
                className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
              >
                Create a project
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onStart={(id) => startTimer(id, null)} />
          ))}
        </div>
      )}

      {showForm && (
        <ProjectFormDialog
          onClose={() => setShowForm(false)}
          onSaved={reload}
        />
      )}
      {conflictDialog}
    </div>
  )
}
