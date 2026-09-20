import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { EntryType, SubtaskStatus, SubtaskWithTotals, Tag } from '@shared/types'
import { formatDuration } from '@shared/duration'
import { useAsync } from '@renderer/lib/queryClient'
import { useTimerActions } from '@renderer/hooks/useTimerActions'
import { StatCard } from '@renderer/components/StatCard'
import { EmptyState } from '@renderer/components/EmptyState'
import { ProjectFormDialog } from '@renderer/components/ProjectFormDialog'
import { SubtaskFormDialog } from '@renderer/components/SubtaskFormDialog'
import { DeleteProjectDialog } from '@renderer/components/DeleteProjectDialog'
import { DeleteSubtaskDialog } from '@renderer/components/DeleteSubtaskDialog'
import { ManualEntryDialog } from '@renderer/components/ManualEntryDialog'
import { EntryRow } from '@renderer/components/EntryRow'
import { Tooltip } from '@renderer/components/Tooltip'
import { useToast } from '@renderer/components/Toast'

const PRIORITY_COLOR: Record<string, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-slate-400'
}

const STATUS_LABEL: Record<SubtaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  archived: 'Archived'
}

function SubtaskRow({
  subtask,
  onStart,
  onChanged,
  onMove,
  canMoveUp,
  canMoveDown
}: {
  subtask: SubtaskWithTotals
  onStart: (subtaskId: number) => void
  onChanged: () => void
  onMove: (direction: 'up' | 'down') => void
  canMoveUp: boolean
  canMoveDown: boolean
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { notify } = useToast()

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
      <div className="flex shrink-0 flex-col">
        <button
          disabled={!canMoveUp}
          onClick={() => onMove('up')}
          aria-label="Move subtask up"
          className="text-xs leading-none text-slate-300 hover:text-slate-600 disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300"
        >
          ▲
        </button>
        <button
          disabled={!canMoveDown}
          onClick={() => onMove('down')}
          aria-label="Move subtask down"
          className="text-xs leading-none text-slate-300 hover:text-slate-600 disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300"
        >
          ▼
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{subtask.title}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {STATUS_LABEL[subtask.status]}
          </span>
          {subtask.priority && (
            <span className={`text-[10px] font-semibold uppercase ${PRIORITY_COLOR[subtask.priority]}`}>
              {subtask.priority}
            </span>
          )}
          {subtask.dueDate && (
            <span className="text-[10px] text-slate-400">due {subtask.dueDate}</span>
          )}
        </div>
        {subtask.description && (
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{subtask.description}</p>
        )}
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          {formatDuration(subtask.totals.totalSeconds)} total · {formatDuration(subtask.totals.todaySeconds)} today
          {subtask.estimatedMinutes ? ` · est. ${formatDuration(subtask.estimatedMinutes * 60)}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {subtask.status !== 'archived' && subtask.status !== 'completed' && (
          <Tooltip label="Start a timer for this subtask">
            <button
              onClick={() => onStart(subtask.id)}
              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-accent-100 hover:text-accent-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-accent-900/40"
            >
              ▶
            </button>
          </Tooltip>
        )}
        {subtask.status !== 'completed' && (
          <button
            onClick={async () => {
              await window.api.subtasks.complete(subtask.id)
              notify('Subtask completed')
              onChanged()
            }}
            className="text-xs text-slate-400 hover:text-emerald-600"
          >
            Complete
          </button>
        )}
        <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-accent-600">
          Edit
        </button>
        <button onClick={() => setDeleting(true)} className="text-xs text-slate-400 hover:text-red-600">
          Delete
        </button>
      </div>

      {editing && (
        <SubtaskFormDialog
          projectId={subtask.projectId}
          subtask={subtask}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
      {deleting && (
        <DeleteSubtaskDialog
          subtaskId={subtask.id}
          subtaskTitle={subtask.title}
          onClose={() => setDeleting(false)}
          onDeleted={onChanged}
        />
      )}
    </div>
  )
}

export function ProjectDetail(): JSX.Element {
  const { projectId: projectIdParam } = useParams()
  const projectId = Number(projectIdParam)
  const navigate = useNavigate()
  const { notify } = useToast()
  const { startTimer, conflictDialog } = useTimerActions()

  const { data: project, loading, reload } = useAsync(() => window.api.projects.get(projectId), [projectId])
  const { data: subtasks, reload: reloadSubtasks } = useAsync(
    () => window.api.subtasks.listForProject(projectId),
    [projectId]
  )
  const { data: tags, reload: reloadTags } = useAsync(
    () => window.api.tags.listForProject(projectId),
    [projectId]
  )

  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryType | ''>('')
  const [subtaskFilter, setSubtaskFilter] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: entries, reload: reloadEntries } = useAsync(
    () =>
      window.api.entries.listForProject(projectId, {
        entryType: entryTypeFilter || undefined,
        subtaskId: subtaskFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      }),
    [projectId, entryTypeFilter, subtaskFilter, startDate, endDate]
  )

  useEffect(() => {
    const unsubscribe = window.api.events.onTimerChanged(() => {
      reload()
      reloadSubtasks()
      reloadEntries()
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [showEditProject, setShowEditProject] = useState(false)
  const [showDeleteProject, setShowDeleteProject] = useState(false)
  const [showAddSubtask, setShowAddSubtask] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)

  function reloadAll(): void {
    reload()
    reloadSubtasks()
    reloadEntries()
    reloadTags()
  }

  async function handleMoveSubtask(subtaskId: number, direction: 'up' | 'down'): Promise<void> {
    if (!subtasks) return
    const index = subtasks.findIndex((s) => s.id === subtaskId)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapWith < 0 || swapWith >= subtasks.length) return
    const orderedIds = subtasks.map((s) => s.id)
    ;[orderedIds[index], orderedIds[swapWith]] = [orderedIds[swapWith], orderedIds[index]]
    await window.api.subtasks.reorder(projectId, orderedIds)
    reloadSubtasks()
  }

  async function handleExportCsv(): Promise<void> {
    const csv = await window.api.projects.exportCsv(projectId)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project?.name ?? 'project'}-time-log.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>
  if (!project) {
    return (
      <div className="p-6">
        <EmptyState title="Project not found" description="It may have been deleted." />
      </div>
    )
  }

  const { totals } = project
  const isCompleted = project.status === 'completed'
  const elapsedCalendarDays =
    project.startedAt && project.completedAt
      ? Math.round((project.completedAt - project.startedAt) / (24 * 60 * 60 * 1000))
      : null
  const estimatedTotalMinutes = (subtasks ?? []).reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={() => navigate('/projects')}
            className="mb-2 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ← Back to projects
          </button>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color ?? '#94a3b8' }} />
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{project.name}</h1>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {project.status}
            </span>
            {totals.isTrackingNow && (
              <span className="text-xs font-medium text-accent-600 dark:text-accent-400">● Tracking now</span>
            )}
          </div>
          {project.description && (
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{project.description}</p>
          )}
          {project.category && (
            <p className="mt-1 text-xs text-slate-400">Category: {project.category}</p>
          )}
          {tags && tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t: Tag) => (
                <span
                  key={t.id}
                  className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"
                >
                  #{t.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => startTimer(projectId, null)}
            className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
          >
            ▶ Start timer
          </button>
          <button
            onClick={() => setShowManualEntry(true)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            + Add time
          </button>
          <button
            onClick={handleExportCsv}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowEditProject(true)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Edit
          </button>
          {project.status === 'archived' ? (
            <button
              onClick={async () => {
                await window.api.projects.restore(projectId)
                notify('Project restored')
                reloadAll()
              }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={async () => {
                await window.api.projects.archive(projectId)
                notify('Project archived')
                reloadAll()
              }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Archive
            </button>
          )}
          {isCompleted ? (
            <button
              onClick={async () => {
                await window.api.projects.reopen(projectId)
                notify('Project reopened')
                reloadAll()
              }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Reopen
            </button>
          ) : (
            <button
              onClick={async () => {
                await window.api.projects.complete(projectId)
                notify('Project marked complete')
                reloadAll()
              }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Mark complete
            </button>
          )}
          <button
            onClick={() => setShowDeleteProject(true)}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Total tracked time
        </p>
        <p className="mt-1 text-4xl font-bold text-slate-900 dark:text-slate-100">
          {formatDuration(totals.totalSeconds)}
        </p>
        <div className="mt-3 flex gap-6 text-sm text-slate-500 dark:text-slate-400">
          <span>Direct: <strong className="text-slate-700 dark:text-slate-200">{formatDuration(totals.directSeconds)}</strong></span>
          <span>Subtasks: <strong className="text-slate-700 dark:text-slate-200">{formatDuration(totals.subtaskSeconds)}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Today" value={formatDuration(totals.todaySeconds)} />
        <StatCard label="This week" value={formatDuration(totals.weekSeconds)} />
        <StatCard
          label="Subtasks"
          value={`${totals.completedSubtaskCount}/${totals.subtaskCount}`}
          hint="completed"
        />
      </div>

      {isCompleted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-900/10">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Completed project summary
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-slate-400">Started</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                {project.startedAt ? new Date(project.startedAt).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Completed</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                {project.completedAt ? new Date(project.completedAt).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Elapsed calendar time</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                {elapsedCalendarDays != null ? `${elapsedCalendarDays} days` : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Sessions logged</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">{entries?.length ?? '—'}</p>
            </div>
          </div>
          {estimatedTotalMinutes > 0 && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Estimated {formatDuration(estimatedTotalMinutes * 60)} vs. actual{' '}
              {formatDuration(totals.totalSeconds)} ({totals.totalSeconds > estimatedTotalMinutes * 60 ? 'over' : 'under'}{' '}
              estimate)
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Subtasks</h2>
          <button
            onClick={() => setShowAddSubtask(true)}
            className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
          >
            + Add subtask
          </button>
        </div>
        {!subtasks || subtasks.length === 0 ? (
          <EmptyState
            icon="☐"
            title="No subtasks yet"
            description="Break this project into pieces to track time more precisely."
          />
        ) : (
          <div>
            {subtasks.map((s, index) => (
              <SubtaskRow
                key={s.id}
                subtask={s}
                onStart={(id) => startTimer(projectId, id)}
                onChanged={reloadAll}
                onMove={(direction) => handleMoveSubtask(s.id, direction)}
                canMoveUp={index > 0}
                canMoveDown={index < subtasks.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Session log</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <select
              value={subtaskFilter}
              onChange={(e) => setSubtaskFilter(e.target.value ? Number(e.target.value) : '')}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">All subtasks</option>
              {(subtasks ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <select
              value={entryTypeFilter}
              onChange={(e) => setEntryTypeFilter(e.target.value as EntryType | '')}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">All types</option>
              <option value="timer">Timer</option>
              <option value="manual">Manual</option>
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
        </div>
        {!entries || entries.length === 0 ? (
          <EmptyState icon="🕐" title="No sessions match these filters" description="Try widening the date range." />
        ) : (
          <div>
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} onChanged={reloadEntries} />
            ))}
          </div>
        )}
      </div>

      {showEditProject && (
        <ProjectFormDialog project={project} onClose={() => setShowEditProject(false)} onSaved={reloadAll} />
      )}
      {showAddSubtask && (
        <SubtaskFormDialog
          projectId={projectId}
          onClose={() => setShowAddSubtask(false)}
          onSaved={reloadAll}
        />
      )}
      {showManualEntry && (
        <ManualEntryDialog
          defaultProjectId={projectId}
          onClose={() => setShowManualEntry(false)}
          onSaved={reloadAll}
        />
      )}
      {showDeleteProject && (
        <DeleteProjectDialog
          projectId={projectId}
          projectName={project.name}
          onClose={() => setShowDeleteProject(false)}
          onArchived={() => {
            setShowDeleteProject(false)
            reloadAll()
          }}
          onDeleted={() => navigate('/projects')}
        />
      )}
      {conflictDialog}
    </div>
  )
}
