import { useEffect, type ReactNode } from 'react'

export function Modal({
  title,
  onClose,
  children,
  width = 'md'
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: 'sm' | 'md' | 'lg'
}): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const widthClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[width]

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${widthClass} max-h-[85vh] overflow-y-auto rounded-xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
