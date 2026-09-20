import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useAsync } from '@renderer/lib/queryClient'
import { formatDuration } from '@shared/duration'
import { StatCard } from '@renderer/components/StatCard'
import { EmptyState } from '@renderer/components/EmptyState'

const PROJECT_COLORS = ['#3c65f5', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#64748b']

function DurationTooltip({ active, payload }: any): JSX.Element | null {
  if (!active || !payload?.length) return null
  const point = payload[0]
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800">
      <p className="font-medium text-slate-700 dark:text-slate-200">{point.payload.label ?? point.payload.name}</p>
      <p className="text-slate-500 dark:text-slate-400">{formatDuration(point.value as number)}</p>
    </div>
  )
}

export function Reports(): JSX.Element {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: report, loading } = useAsync(
    () => window.api.reports.totals({ startDate: startDate || undefined, endDate: endDate || undefined }),
    [startDate, endDate]
  )

  if (loading || !report) {
    return <div className="p-6 text-sm text-slate-400">Loading…</div>
  }

  const projectChartData = report.byProject.slice(0, 8).map((p) => ({
    name: p.projectName.length > 16 ? `${p.projectName.slice(0, 15)}…` : p.projectName,
    label: p.projectName,
    value: p.totalSeconds / 3600
  }))

  const dailyChartData = report.daily.slice(-30).map((d) => ({
    name: d.localDate.slice(5),
    label: d.localDate,
    value: d.totalSeconds / 3600
  }))

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Reports</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">Where your tracked time has gone.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-900"
          />
          <span className="self-center text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total time" value={formatDuration(report.grandTotalSeconds)} />
        <StatCard label="Active projects" value={String(report.activeVsCompleted.active)} />
        <StatCard label="Completed projects" value={String(report.activeVsCompleted.completed)} />
        <StatCard
          label="Top project"
          value={report.topProjects[0]?.projectName ?? '—'}
          hint={report.topProjects[0] ? formatDuration(report.topProjects[0].totalSeconds) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Time by project (hours)
          </p>
          {projectChartData.length === 0 ? (
            <EmptyState title="No data yet" description="Track some time to see this chart fill in." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={projectChartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400" />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400" />
                <RechartsTooltip content={<DurationTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {projectChartData.map((entry, i) => (
                    <Cell key={entry.label} fill={PROJECT_COLORS[i % PROJECT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Daily totals (hours)
          </p>
          {dailyChartData.length === 0 ? (
            <EmptyState title="No data yet" description="Track some time to see this chart fill in." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyChartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="currentColor" className="text-slate-400" />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400" />
                <RechartsTooltip content={<DurationTooltip />} />
                <Bar dataKey="value" fill="#3c65f5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          By project
        </p>
        <div className="flex flex-col">
          {report.byProject.map((p) => (
            <div
              key={p.projectId}
              className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800"
            >
              <span className="text-slate-700 dark:text-slate-200">{p.projectName}</span>
              <span className="font-medium text-slate-500 dark:text-slate-400">{formatDuration(p.totalSeconds)}</span>
            </div>
          ))}
        </div>
      </div>

      {report.bySubtask.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            By subtask
          </p>
          <div className="flex flex-col">
            {report.bySubtask.map((s) => (
              <div
                key={s.subtaskId}
                className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800"
              >
                <span className="text-slate-700 dark:text-slate-200">
                  {s.projectName} <span className="text-slate-400">· {s.subtaskTitle}</span>
                </span>
                <span className="font-medium text-slate-500 dark:text-slate-400">{formatDuration(s.totalSeconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
