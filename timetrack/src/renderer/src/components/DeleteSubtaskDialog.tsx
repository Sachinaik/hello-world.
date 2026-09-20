import { useEffect, useState } from 'react'
import type { DeleteSubtaskPreview } from '@shared/types'
import { Modal } from './Modal'
import { useToast } from './Toast'

export function DeleteSubtaskDialog({
  subtaskId,
  subtaskTitle,
  onClose,
  onDeleted
}: {
  subtaskId: number
  subtaskTitle: string
  onClose: () => void
  onDeleted: () => void
}): JSX.Element {
  const [preview, setPreview] = useState<DeleteSubtaskPreview | null>(null)
  const { notify } = useToast()

  useEffect(() => {
    window.api.subtasks.deletePreview(subtaskId).then(setPreview)
  }, [subtaskId])

  return (
    <Modal title={`Delete "${subtaskTitle}"?`} onClose={onClose} width="sm">
      {!preview ? (
        <p className="text-sm text-slate-400">Checking tracked time…</p>
      ) : (
        <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
          {preview.entryCount > 0 ? (
            <p>
              This subtask has <strong>{preview.entryCount}</strong> tracked time{' '}
              {preview.entryCount === 1 ? 'entry' : 'entries'}. Deleting it will reassign that time to the
              project's direct time — the project's total is unchanged, and no time is lost.
            </p>
          ) : (
            <p>This subtask has no tracked time. It can be safely deleted.</p>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await window.api.subtasks.delete(subtaskId)
                notify('Subtask deleted')
                onDeleted()
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete subtask
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
