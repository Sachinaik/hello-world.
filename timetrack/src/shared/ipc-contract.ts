// The single typed contract for the IPC boundary. The preload script
// exposes exactly these methods through contextBridge; the renderer never
// gets raw ipcRenderer access. Main process handlers are registered against
// this same channel list, so a channel added here and forgotten on either
// side is a compile error, not a runtime surprise.

import type {
  AppSettingsMap,
  BackupResult,
  CrashRecoveryChoice,
  CrashRecoveryInfo,
  CreateManualEntryInput,
  DashboardSummary,
  DeleteProjectPreview,
  DeleteSubtaskPreview,
  EditEntryInput,
  HistoryDayGroup,
  HistoryFilter,
  JsonExportPayload,
  OverlapWarning,
  Priority,
  Project,
  ProjectStatus,
  ProjectWithTotals,
  ReportFilter,
  ReportTotals,
  SleepResumePrompt,
  Subtask,
  SubtaskStatus,
  SubtaskWithTotals,
  Tag,
  TimeEntry,
  TimeEntryWithNames
} from './types'

export interface IpcApi {
  projects: {
    list(filter?: { status?: ProjectStatus; search?: string }): Promise<ProjectWithTotals[]>
    get(id: number): Promise<ProjectWithTotals | null>
    create(input: {
      name: string
      description?: string | null
      color?: string | null
      category?: string | null
      startedAt?: number | null
    }): Promise<Project>
    update(
      id: number,
      patch: Partial<{
        name: string
        description: string | null
        color: string | null
        category: string | null
        status: ProjectStatus
        startedAt: number | null
        completedAt: number | null
      }>
    ): Promise<Project>
    archive(id: number): Promise<Project>
    restore(id: number): Promise<Project>
    complete(id: number): Promise<Project>
    reopen(id: number): Promise<Project>
    deletePreview(id: number): Promise<DeleteProjectPreview>
    delete(id: number): Promise<void>
    exportCsv(id: number): Promise<string>
  }
  subtasks: {
    listForProject(projectId: number): Promise<SubtaskWithTotals[]>
    create(input: {
      projectId: number
      title: string
      description?: string | null
      priority?: Priority | null
      estimatedMinutes?: number | null
      dueDate?: string | null
    }): Promise<Subtask>
    update(
      id: number,
      patch: Partial<{
        title: string
        description: string | null
        status: SubtaskStatus
        priority: Priority | null
        estimatedMinutes: number | null
        dueDate: string | null
        position: number
      }>
    ): Promise<Subtask>
    reorder(projectId: number, orderedIds: number[]): Promise<void>
    complete(id: number): Promise<Subtask>
    archive(id: number): Promise<Subtask>
    deletePreview(id: number): Promise<DeleteSubtaskPreview>
    delete(id: number): Promise<void>
  }
  timer: {
    getActive(): Promise<{ entry: TimeEntry; projectName: string; subtaskTitle: string | null } | null>
    start(
      projectId: number,
      subtaskId: number | null
    ): Promise<{ entry: TimeEntry } | { conflict: { currentLabel: string } }>
    confirmSwitchAndStart(projectId: number, subtaskId: number | null): Promise<TimeEntry>
    pause(): Promise<void>
    resume(projectId: number, subtaskId: number | null): Promise<TimeEntry>
    stop(): Promise<void>
    checkCrashRecovery(): Promise<CrashRecoveryInfo | null>
    resolveCrashRecovery(choice: CrashRecoveryChoice): Promise<void>
    checkSleepResume(): Promise<SleepResumePrompt | null>
    resolveSleepResume(shouldResume: boolean): Promise<void>
  }
  entries: {
    createManual(input: CreateManualEntryInput): Promise<TimeEntry>
    checkOverlap(
      projectId: number,
      startedAt: number,
      endedAt: number
    ): Promise<OverlapWarning>
    update(input: EditEntryInput): Promise<TimeEntry>
    delete(id: number): Promise<void>
    history(filter: HistoryFilter): Promise<HistoryDayGroup[]>
    listForProject(projectId: number, filter?: HistoryFilter): Promise<TimeEntryWithNames[]>
  }
  dashboard: {
    summary(): Promise<DashboardSummary>
  }
  reports: {
    totals(filter: ReportFilter): Promise<ReportTotals>
  }
  tags: {
    list(): Promise<Tag[]>
    create(name: string): Promise<Tag>
    setForProject(projectId: number, tagIds: number[]): Promise<void>
  }
  settings: {
    getAll(): Promise<AppSettingsMap>
    set(key: string, value: string): Promise<void>
  }
  data: {
    backupDatabase(): Promise<BackupResult>
    exportJson(): Promise<JsonExportPayload>
    importJson(payload: JsonExportPayload): Promise<void>
    restoreFromFile(sourcePath: string): Promise<void>
    loadSeedData(): Promise<void>
    removeSeedData(): Promise<void>
    getDbPath(): Promise<string>
  }
  shortcuts: {
    getRegistrationErrors(): Promise<string[]>
  }
  events: {
    onTimerChanged(callback: () => void): () => void
    onSleepResumeNeeded(callback: (prompt: SleepResumePrompt) => void): () => void
  }
}

export const IPC_CHANNELS = {
  'projects:list': 'projects:list',
  'projects:get': 'projects:get',
  'projects:create': 'projects:create',
  'projects:update': 'projects:update',
  'projects:archive': 'projects:archive',
  'projects:restore': 'projects:restore',
  'projects:complete': 'projects:complete',
  'projects:reopen': 'projects:reopen',
  'projects:deletePreview': 'projects:deletePreview',
  'projects:delete': 'projects:delete',
  'projects:exportCsv': 'projects:exportCsv',
  'subtasks:listForProject': 'subtasks:listForProject',
  'subtasks:create': 'subtasks:create',
  'subtasks:update': 'subtasks:update',
  'subtasks:reorder': 'subtasks:reorder',
  'subtasks:complete': 'subtasks:complete',
  'subtasks:archive': 'subtasks:archive',
  'subtasks:deletePreview': 'subtasks:deletePreview',
  'subtasks:delete': 'subtasks:delete',
  'timer:getActive': 'timer:getActive',
  'timer:start': 'timer:start',
  'timer:confirmSwitchAndStart': 'timer:confirmSwitchAndStart',
  'timer:pause': 'timer:pause',
  'timer:resume': 'timer:resume',
  'timer:stop': 'timer:stop',
  'timer:checkCrashRecovery': 'timer:checkCrashRecovery',
  'timer:resolveCrashRecovery': 'timer:resolveCrashRecovery',
  'timer:checkSleepResume': 'timer:checkSleepResume',
  'timer:resolveSleepResume': 'timer:resolveSleepResume',
  'entries:createManual': 'entries:createManual',
  'entries:checkOverlap': 'entries:checkOverlap',
  'entries:update': 'entries:update',
  'entries:delete': 'entries:delete',
  'entries:history': 'entries:history',
  'entries:listForProject': 'entries:listForProject',
  'dashboard:summary': 'dashboard:summary',
  'reports:totals': 'reports:totals',
  'tags:list': 'tags:list',
  'tags:create': 'tags:create',
  'tags:setForProject': 'tags:setForProject',
  'settings:getAll': 'settings:getAll',
  'settings:set': 'settings:set',
  'data:backupDatabase': 'data:backupDatabase',
  'data:exportJson': 'data:exportJson',
  'data:importJson': 'data:importJson',
  'data:restoreFromFile': 'data:restoreFromFile',
  'data:loadSeedData': 'data:loadSeedData',
  'data:removeSeedData': 'data:removeSeedData',
  'data:getDbPath': 'data:getDbPath',
  'shortcuts:getRegistrationErrors': 'shortcuts:getRegistrationErrors',
  // main -> renderer push events
  'events:timerChanged': 'events:timerChanged',
  'events:sleepResumeNeeded': 'events:sleepResumeNeeded'
} as const

export type IpcChannel = keyof typeof IPC_CHANNELS
