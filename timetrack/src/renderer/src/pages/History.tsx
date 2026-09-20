import { useEffect, useState } from 'react'
import type { EntryType, ProjectWithTotals, Tag } from '@shared/types'
import { formatDuration } from '@shared/duration'
import { useAsync } from '@renderer/lib/queryClient'
import { EmptyState } from '@renderer/components/EmptyState'
import { EntryRow } from '@renderer/components/EntryRow'

export function History(): JSX.Element {
  const [projects, setProjects] = useState<ProjectWithTotals[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [projectId, setProjectId] = useState<number | ''>('')
  const [entryType, setEntryType] = useState<EntryType | ''>('')
  const [tagId, setTagId] = useState<number | ''>('')
  const [hasNote, setHasNote] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    window.api.projects.list().then(setProjects)
    window.api.tags.list().then(setTags)
  }, [])

  const { data: groups, loading, reload } = useAsync(
    () =>
      window.api.entries.history({
        projectId: projectId || undefined,
        entryType: entryType || undefined,
        tagId: tagId || undefined,
        hasNote: hasNote || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined
      }),
    [projectId, entryType, tagId, hasNote, startDate, endDate, search]
  )

  function toggle(date: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">History</h1>
        <p className="text-sm text-slate-400 dark:text-slate-500">Every session, grouped by day.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={entryType}
          onChange={(e) => setEntryType(e.target.value as EntryType | '')}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">All types</option>
          <option value="timer">Timer</option>
          <option value="manual">Manual</option>
        </select>
        {tags.length > 0 && (
          <select
            value={tagId}
            onChange={(e) => setTagId(e.target.value ? Number(e.target.value) : '')}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 dark:border-slate-600">
          <input type="checkbox" checked={hasNote} onChange={(e) => setHasNote(e.target.checked)} />
          Has note
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-900"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-900"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes, projects, subtasks…"
          className="min-w-[220px] flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : !groups || groups.length === 0 ? (
        <EmptyState icon="🕐" title="No sessions found" description="Try widening your filters, or start a timer." />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const isOpen = expanded.has(group.localDate)
            return (
              <div
                key={group.localDate}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <button
                  onClick={() => toggle(group.localDate)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {new Date(group.localDate + 'T00:00:00').toLocaleDateString([], {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  <span className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400">{group.entries.length} sessions</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatDuration(group.totalSeconds)}
                    </span>
                    <span className="text-slate-400">{isOpen ? '▾' : '▸'}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 dark:border-slate-800">
                    {group.entries.map((e) => (
                      <EntryRow key={e.id} entry={e} showProject onChanged={reload} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
