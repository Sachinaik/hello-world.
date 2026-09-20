import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import type { CrashRecoveryInfo, SleepResumePrompt } from '@shared/types'
import { ToastProvider } from './components/Toast'
import { Sidebar } from './components/Sidebar'
import { TopBarTimer } from './components/TopBarTimer'
import { CrashRecoveryDialog } from './components/CrashRecoveryDialog'
import { SleepResumeDialog } from './components/SleepResumeDialog'
import { QuickAddDialog } from './components/QuickAddDialog'
import { useTheme } from './hooks/useTheme'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { Reports } from './pages/Reports'
import { History } from './pages/History'
import { Settings } from './pages/Settings'

function AppShell(): JSX.Element {
  useTheme()
  const [crashInfo, setCrashInfo] = useState<CrashRecoveryInfo | null>(null)
  const [sleepPrompt, setSleepPrompt] = useState<SleepResumePrompt | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  useEffect(() => {
    window.api.timer.checkCrashRecovery().then(setCrashInfo)
    window.api.timer.checkSleepResume().then(setSleepPrompt)
    const unsubscribe = window.api.events.onSleepResumeNeeded(setSleepPrompt)
    return unsubscribe
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const isQuickAdd = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k'
      if (isQuickAdd) {
        e.preventDefault()
        setQuickAddOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-slate-200 px-5 dark:border-slate-800">
          <TopBarTimer />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId" element={<ProjectDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>

      {crashInfo && <CrashRecoveryDialog info={crashInfo} onResolved={() => setCrashInfo(null)} />}
      {sleepPrompt && <SleepResumeDialog prompt={sleepPrompt} onResolved={() => setSleepPrompt(null)} />}
      {quickAddOpen && <QuickAddDialog onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}

export default function App(): JSX.Element {
  return (
    <ToastProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </ToastProvider>
  )
}
