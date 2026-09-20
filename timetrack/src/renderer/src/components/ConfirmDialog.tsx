import type { ReactNode } from 'react'
import { Modal } from './Modal'

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}: {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}): JSX.Element {
  return (
    <Modal title={title} onClose={onCancel} width="sm">
      <div className="text-sm text-slate-600 dark:text-slate-300">{message}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`rounded-md px-3 py-1.5 text-sm font-medium text-white ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-accent-600 hover:bg-accent-700'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
