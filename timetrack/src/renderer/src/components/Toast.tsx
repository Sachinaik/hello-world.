import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
  variant: 'success' | 'error'
}

interface ToastContextValue {
  notify: (message: string, variant?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const notify = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              t.variant === 'error' ? 'bg-red-600' : 'bg-slate-900 dark:bg-slate-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
