// Domain types shared between the Electron main process and the renderer.
// The renderer never talks to SQLite directly; every shape here is what
// crosses the typed IPC boundary defined in ipc-contract.ts.

export type ProjectStatus = 'active' | 'completed' | 'archived'
export type SubtaskStatus = 'not_started' | 'in_progress' | 'completed' | 'archived'
export type Priority = 'low' | 'medium' | 'high'
export type EntryType = 'timer' | 'manual'

export interface Project {
  id: number
  name: string
  description: string | null
  status: ProjectStatus
  color: string | null
  category: string | null
  startedAt: number | null
  completedAt: number | null
  archivedAt: number | null
  deleted: 0 | 1
  createdAt: number
  updatedAt: number
}

export interface Subtask {
  id: number
  projectId: number
  title: string
  description: string | null
  status: SubtaskStatus
  priority: Priority | null
  estimatedMinutes: number | null
  dueDate: string | null
  completedAt: number | null
  position: number
  createdAt: number
  updatedAt: number
}

export interface TimeEntry {
  id: number
  projectId: number
  subtaskId: number | null
  startedAt: number
  endedAt: number | null
  durationSeconds: number | null
  localDate: string
  entryType: EntryType
  note: string | null
  lastHeartbeatAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Tag {
  id: number
  name: string
}

export interface ActiveTimerRow {
  timeEntryId: number
}

export interface AppSettingsMap {
  theme: 'light' | 'dark' | 'system'
  shortcutStartPause: string
  shortcutStop: string
  shortcutQuickAdd: string
  seedDataLoaded: 'true' | 'false'
  [key: string]: string
}

// ---- Aggregate / computed shapes returned from main-process SQL ----

export interface ProjectTotals {
  projectId: number
  totalSeconds: number
  directSeconds: number
  subtaskSeconds: number
  todaySeconds: number
  weekSeconds: number
  lastWorkedLocalDate: string | null
  subtaskCount: number
  completedSubtaskCount: number
  isTrackingNow: boolean
}

export interface SubtaskTotals {
  subtaskId: number
  totalSeconds: number
  todaySeconds: number
}

export interface ProjectWithTotals extends Project {
  totals: ProjectTotals
}

export interface SubtaskWithTotals extends Subtask {
  totals: SubtaskTotals
}

export interface DashboardSummary {
  todaySeconds: number
  weekSeconds: number
  activeProjectCount: number
  recentProjects: ProjectWithTotals[]
  topProjects: ProjectWithTotals[]
  sevenDaySummary: { localDate: string; totalSeconds: number }[]
  activeProjects: ProjectWithTotals[]
  runningTimer: RunningTimerInfo | null
}

export interface RunningTimerInfo {
  entry: TimeEntry
  projectName: string
  subtaskTitle: string | null
  projectColor: string | null
}

export interface HistoryDayGroup {
  localDate: string
  totalSeconds: number
  entries: TimeEntryWithNames[]
}

export interface TimeEntryWithNames extends TimeEntry {
  projectName: string
  subtaskTitle: string | null
  crossesMidnight: boolean
}

export interface ReportTotals {
  grandTotalSeconds: number
  byProject: { projectId: number; projectName: string; totalSeconds: number }[]
  bySubtask: {
    subtaskId: number
    subtaskTitle: string
    projectId: number
    projectName: string
    totalSeconds: number
  }[]
  daily: { localDate: string; totalSeconds: number }[]
  weekly: { weekStart: string; totalSeconds: number }[]
  monthly: { month: string; totalSeconds: number }[]
  activeVsCompleted: { active: number; completed: number }
  mostRecentProjects: { projectId: number; projectName: string; lastWorkedLocalDate: string }[]
  topProjects: { projectId: number; projectName: string; totalSeconds: number }[]
}

export interface DateRangeFilter {
  startDate?: string // YYYY-MM-DD inclusive
  endDate?: string // YYYY-MM-DD inclusive
}

export interface HistoryFilter extends DateRangeFilter {
  projectId?: number
  subtaskId?: number
  entryType?: EntryType
  search?: string
}

export interface ReportFilter extends DateRangeFilter {
  projectId?: number
}

export interface OverlapWarning {
  overlapsWith: {
    projectName: string
    startedAt: number
    endedAt: number | null
  }[]
}

export interface CreateManualEntryInput {
  projectId: number
  subtaskId: number | null
  date: string // YYYY-MM-DD, local
  startTime?: string // HH:mm
  endTime?: string // HH:mm
  durationMinutes?: number
  note?: string | null
}

export interface EditEntryInput {
  id: number
  projectId?: number
  subtaskId?: number | null
  startedAt?: number
  endedAt?: number | null
  note?: string | null
}

export interface CrashRecoveryInfo {
  entry: TimeEntry
  projectName: string
  subtaskTitle: string | null
  usedFallbackToStartedAt: boolean
}

export type CrashRecoveryChoice =
  | { action: 'closeAndContinue' }
  | { action: 'closeAndStop' }
  | { action: 'closeAndEditManually'; endedAt: number }

export interface SleepResumePrompt {
  entry: TimeEntry
  projectName: string
  subtaskTitle: string | null
  suspendedAt: number
}

export interface BackupResult {
  filePath: string
}

export interface JsonExportPayload {
  schemaVersion: number
  exportedAt: number
  projects: Project[]
  subtasks: Subtask[]
  timeEntries: TimeEntry[]
  tags: Tag[]
  projectTags: { projectId: number; tagId: number }[]
}

export interface DeleteProjectPreview {
  entryCount: number
  subtaskCount: number
}

export interface DeleteSubtaskPreview {
  entryCount: number
}
