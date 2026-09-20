import { useEffect, useState } from 'react'
import type { DeleteProjectPreview } from '@shared/types'
import { Modal } from './Modal'
import { useToast } from './Toast'

export function DeleteProjectDialog({
  projectId,
  projectName,
  onClose,
  onArchived,
  onDeleted
}: {
  projectId: number
  projectName: string
  onClose: () => void
  onArchived: () => void
  onDeleted: () => void
}): JSX.Element {
  const [preview, setPreview] = useState<DeleteProjectPreview | null>(null)
  const { notify } = useToast()

  useEffect(() => {
    window.api.projects.deletePreview(projectId).then(setPreview)
  }, [projectId])

  return (
    <Modal title={`Delete "${projectName}"?`} onClose={onClose} width="sm">
      {!preview ? (
        <p className="text-sm text-slate-400">Checking what this project holds…</p>
      ) : (
        <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
          {preview.entryCount > 0 || preview.subtaskCount > 0 ? (
            <p>
              This project has <strong>{preview.entryCount}</strong> tracked time{' '}
              {preview.entryCount === 1 ? 'entry' : 'entries'} and <strong>{preview.subtaskCount}</strong>{' '}
              {preview.subtaskCount === 1 ? 'subtask' : 'subtasks'}. Deleting it will hide it from active
              lists, but every entry stays intact and reachable from reports — nothing is destroyed.
            </p>
          ) : (
            <p>This project has no tracked time or subtasks. It can be safely deleted.</p>
          )}
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-slate-700/50">
            Prefer to keep it around instead? <strong>Archiving</strong> removes it from your active list too,
            but you can restore it any time from the Archived tab.
          </p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await window.api.projects.archive(projectId)
                notify('Project archived')
                onArchived()
              }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Archive instead
            </button>
            <button
              onClick={async () => {
                await window.api.projects.delete(projectId)
                notify('Project deleted')
                onDeleted()
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete project
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
