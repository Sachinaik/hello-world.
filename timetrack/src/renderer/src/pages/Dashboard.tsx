import { Link } from 'react-router-dom'
import type { DashboardSummary } from '@shared/types'
import { formatDuration, formatClock } from '@shared/duration'
import { useAsync } from '@renderer/lib/queryClient'
import { useActiveTimer } from '@renderer/hooks/useActiveTimer'
import { useTimerActions } from '@renderer/hooks/useTimerActions'
import { StatCard } from '@renderer/components/StatCard'
import { ProjectCard } from '@renderer/components/ProjectCard'
import { ProjectSubtaskPicker } from '@renderer/components/ProjectSubtaskPicker'
import { EmptyState } from '@renderer/components/EmptyState'
import { useEffect } from 'react'

function SevenDayBars({ data }: { data: DashboardSummary['sevenDaySummary'] }): JSX.Element {
  const max = Math.max(1, ...data.map((d) => d.totalSeconds))
  return (
    <div className="flex h-24 items-end gap-2">
      {data.map((d) => {
        const dayLabel = new Date(d.localDate + 'T00:00:00').toLocaleDateString([], { weekday: 'short' })
        const height = Math.max(3, Math.round((d.totalSeconds / max) * 88))
        return (
          <div key={d.localDate} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full items-end">
              <div
                className="w-full rounded-t-sm bg-accent-500/80 transition-all dark:bg-accent-500/60"
                style={{ height: `${height}px` }}
                title={formatDuration(d.totalSeconds)}
              />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{dayLabel[0]}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Dashboard(): JSX.Element {
  const { data: summary, loading, reload } = useAsync(() => window.api.dashboard.summary(), [])
  const { active, elapsedSeconds } = useActiveTimer()
  const { startTimer, conflictDialog } = useTimerActions()

  useEffect(() => {
    const unsubscribe = window.api.events.onTimerChanged(reload)
    return unsubscribe
  }, [reload])

  if (loading || !summary) {
    return <div className="p-6 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-400 dark:text-slate-500">A quick look at where your time is going.</p>
      </div>

      {active ? (
        <div className="rounded-xl border border-accent-200 bg-accent-50 p-5 dark:border-accent-800 dark:bg-accent-900/20">
          <p className="text-xs font-medium uppercase tracking-wide text-accent-600 dark:text-accent-400">
            Currently tracking
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {active.projectName}
                {active.subtaskTitle && (
                  <span className="text-slate-500 dark:text-slate-400"> · {active.subtaskTitle}</span>
                )}
              </p>
              <p className="font-mono text-2xl tabular-nums text-accent-700 dark:text-accent-300">
                {formatClock(elapsedSeconds)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.api.timer.pause()}
                className="rounded-md border border-accent-300 bg-white px-3 py-1.5 text-sm font-medium text-accent-700 hover:bg-accent-100 dark:border-accent-700 dark:bg-slate-900 dark:text-accent-300"
              >
                ⏸ Pause
              </button>
              <button
                onClick={() => window.api.timer.stop()}
                className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
              >
                ⏹ Stop
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Start tracking
          </p>
          <ProjectSubtaskPicker onStart={startTimer} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Today" value={formatDuration(summary.todaySeconds)} />
        <StatCard label="This week" value={formatDuration(summary.weekSeconds)} />
        <StatCard label="Active projects" value={String(summary.activeProjectCount)} />
        <StatCard
          label="Top project"
          value={summary.topProjects[0]?.name ?? '—'}
          hint={summary.topProjects[0] ? formatDuration(summary.topProjects[0].totals.totalSeconds) : undefined}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Last 7 days
        </p>
        <SevenDayBars data={summary.sevenDaySummary} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Active projects</h2>
          <Link to="/projects" className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-400">
            View all →
          </Link>
        </div>
        {summary.activeProjects.length === 0 ? (
          <EmptyState
            title="No active projects yet"
            description="Create your first project to start tracking time against it."
            action={
              <Link
                to="/projects"
                className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
              >
                Create a project
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.activeProjects.map((p) => (
              <ProjectCard key={p.id} project={p} onStart={(id) => startTimer(id, null)} />
            ))}
          </div>
        )}
      </div>

      {conflictDialog}
    </div>
  )
}
