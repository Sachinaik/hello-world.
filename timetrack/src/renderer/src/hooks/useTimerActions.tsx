import { useCallback, useState } from 'react'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { useToast } from '@renderer/components/Toast'

interface PendingSwitch {
  projectId: number
  subtaskId: number | null
  currentLabel: string
}

function formatLabel(projectName: string, subtaskTitle: string | null): string {
  return subtaskTitle ? `${projectName} – ${subtaskTitle}` : projectName
}

/**
 * Wraps timer.start with the "a timer is already running" conflict flow
 * required by the spec: on conflict, show a confirmation dialog and only
 * switch (closing the old entry, opening the new one atomically) if the
 * user agrees.
 */
export function useTimerActions(): {
  startTimer: (projectId: number, subtaskId: number | null) => void
  conflictDialog: JSX.Element | null
} {
  const [pending, setPending] = useState<PendingSwitch | null>(null)
  const { notify } = useToast()

  const startTimer = useCallback(
    (projectId: number, subtaskId: number | null) => {
      window.api.timer
        .start(projectId, subtaskId)
        .then((result) => {
          if ('conflict' in result) {
            setPending({
              projectId,
              subtaskId,
              currentLabel: formatLabel(result.conflict.projectName, result.conflict.subtaskTitle)
            })
          } else {
            notify('Timer started')
          }
        })
        .catch((err: unknown) => notify(err instanceof Error ? err.message : 'Could not start timer', 'error'))
    },
    [notify]
  )

  const conflictDialog = pending ? (
    <ConfirmDialog
      title="A timer is already running"
      message={`A timer is already running for ${pending.currentLabel}. Stop it and start the new timer?`}
      confirmLabel="Stop and start new"
      onCancel={() => setPending(null)}
      onConfirm={() => {
        window.api.timer
          .confirmSwitchAndStart(pending.projectId, pending.subtaskId)
          .then(() => {
            notify('Timer switched')
            setPending(null)
          })
          .catch((err: unknown) => {
            notify(err instanceof Error ? err.message : 'Could not switch timer', 'error')
            setPending(null)
          })
      }}
    />
  ) : null

  return { startTimer, conflictDialog }
}
