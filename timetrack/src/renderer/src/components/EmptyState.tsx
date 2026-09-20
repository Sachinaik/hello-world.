import type { ReactNode } from 'react'

export function EmptyState({
  icon = '◇',
  title,
  description,
  action
}: {
  icon?: string
  title: string
  description: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-700">
      <span className="text-3xl">{icon}</span>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="max-w-sm text-sm text-slate-400 dark:text-slate-500">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
