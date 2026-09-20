import { Link } from 'react-router-dom'
import type { ProjectWithTotals } from '@shared/types'
import { formatDuration } from '@shared/duration'
import { Tooltip } from './Tooltip'

export function ProjectCard({
  project,
  onStart
}: {
  project: ProjectWithTotals
  onStart: (projectId: number) => void
}): JSX.Element {
  const { totals } = project
  const progress =
    totals.subtaskCount > 0 ? Math.round((totals.completedSubtaskCount / totals.subtaskCount) * 100) : null

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      {totals.isTrackingNow && (
        <span className="absolute right-4 top-4 flex items-center gap-1.5 text-xs font-medium text-accent-600 dark:text-accent-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-600" />
          </span>
          Tracking
        </span>
      )}

      <Link to={`/projects/${project.id}`} className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: project.color ?? '#94a3b8' }}
          />
          <h3 className="truncate text-sm font-semibold text-slate-900 hover:text-accent-600 dark:text-slate-100 dark:hover:text-accent-400">
            {project.name}
          </h3>
        </div>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{project.description}</p>
        )}
      </Link>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-400 dark:text-slate-500">Total time</p>
          <p className="font-medium text-slate-700 dark:text-slate-200">{formatDuration(totals.totalSeconds)}</p>
        </div>
        <div>
          <p className="text-slate-400 dark:text-slate-500">Today</p>
          <p className="font-medium text-slate-700 dark:text-slate-200">{formatDuration(totals.todaySeconds)}</p>
        </div>
      </div>

      {totals.subtaskCount > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>
              {totals.completedSubtaskCount}/{totals.subtaskCount} subtasks
            </span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-1.5 rounded-full bg-accent-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 text-xs text-slate-400 dark:text-slate-500">
        <span>
          {totals.lastWorkedLocalDate ? `Last worked ${totals.lastWorkedLocalDate}` : 'No time logged yet'}
        </span>
        <Tooltip label="Start a timer for this project">
          <button
            onClick={() => onStart(project.id)}
            className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600 opacity-0 transition-opacity hover:bg-accent-100 hover:text-accent-700 group-hover:opacity-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-accent-900/40"
          >
            ▶ Start
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
