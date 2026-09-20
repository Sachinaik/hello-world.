import { useEffect, useState } from 'react'
import type { ProjectWithTotals, SubtaskWithTotals } from '@shared/types'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { todayLocalDate } from '@shared/localDate'

type Mode = 'range' | 'duration'

export function ManualEntryDialog({
  onClose,
  defaultProjectId,
  onSaved
}: {
  onClose: () => void
  defaultProjectId?: number
  onSaved?: () => void
}): JSX.Element {
  const { notify } = useToast()
  const [projects, setProjects] = useState<ProjectWithTotals[]>([])
  const [subtasks, setSubtasks] = useState<SubtaskWithTotals[]>([])
  const [projectId, setProjectId] = useState<number | ''>(defaultProjectId ?? '')
  const [subtaskId, setSubtaskId] = useState<number | ''>('')
  const [date, setDate] = useState(todayLocalDate())
  const [mode, setMode] = useState<Mode>('range')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [hours, setHours] = useState(1)
  const [minutes, setMinutes] = useState(0)
  const [note, setNote] = useState('')
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.projects.list().then(setProjects)
  }, [])

  useEffect(() => {
    if (projectId === '') {
      setSubtasks([])
      return
    }
    window.api.subtasks.listForProject(projectId).then(setSubtasks)
  }, [projectId])

  useEffect(() => {
    setOverlapWarning(null)
    if (projectId === '' || mode !== 'range') return
    const [y, m, d] = date.split('-').map(Number)
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const start = new Date(y, m - 1, d, sh, sm).getTime()
    let end = new Date(y, m - 1, d, eh, em).getTime()
    if (end <= start) end += 24 * 60 * 60 * 1000
    window.api.entries.checkOverlap(projectId, start, end).then((result) => {
      if (result.overlapsWith.length > 0) {
        const first = result.overlapsWith[0]
        const fmt = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setOverlapWarning(
          `This overlaps an existing entry on ${first.projectName} from ${fmt(first.startedAt)} to ${
            first.endedAt ? fmt(first.endedAt) : '…'
          }.`
        )
      }
    })
  }, [projectId, date, startTime, endTime, mode])

  async function handleSave(): Promise<void> {
    if (projectId === '') return
    setSaving(true)
    try {
      await window.api.entries.createManual({
        projectId,
        subtaskId: subtaskId || null,
        date,
        ...(mode === 'range' ? { startTime, endTime } : { durationMinutes: hours * 60 + minutes }),
        note: note || null
      })
      notify('Time entry added')
      onSaved?.()
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save entry', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add manual time" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Project</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="">Choose a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Subtask (optional)</span>
          <select
            value={subtaskId}
            disabled={!projectId}
            onChange={(e) => setSubtaskId(e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="">(Project-level time)</option>
            {subtasks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} />
            Start / end time
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === 'duration'} onChange={() => setMode('duration')} />
            Duration
          </label>
        </div>

        {mode === 'range' ? (
          <div className="flex gap-3">
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Start</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">End</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          </div>
        ) : (
          <div className="flex gap-3">
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Hours</span>
              <input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Minutes</span>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          </div>
        )}

        {overlapWarning && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            ⚠ {overlapWarning} You can still save this entry.
          </p>
        )}

        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            disabled={!projectId || saving}
            onClick={handleSave}
            className="rounded-md bg-accent-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
          >
            Save entry
          </button>
        </div>
      </div>
    </Modal>
  )
}
