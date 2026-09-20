import type { SleepResumePrompt } from '@shared/types'
import { Modal } from './Modal'

export function SleepResumeDialog({
  prompt,
  onResolved
}: {
  prompt: SleepResumePrompt
  onResolved: () => void
}): JSX.Element {
  const label = prompt.subtaskTitle ? `${prompt.projectName} · ${prompt.subtaskTitle}` : prompt.projectName

  async function resolve(shouldResume: boolean): Promise<void> {
    await window.api.timer.resolveSleepResume(shouldResume)
    onResolved()
  }

  return (
    <Modal title="Your computer went to sleep" onClose={() => resolve(false)} width="sm">
      <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
        <p>
          The timer for <strong className="text-slate-900 dark:text-slate-100">{label}</strong> was stopped when
          your machine went to sleep at {new Date(prompt.suspendedAt).toLocaleTimeString()}. Sleep time was not
          counted as work.
        </p>
        <p>Start a new entry on the same item now?</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => resolve(false)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
          >
            No, stay stopped
          </button>
          <button
            onClick={() => resolve(true)}
            className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-700"
          >
            Resume
          </button>
        </div>
      </div>
    </Modal>
  )
}
