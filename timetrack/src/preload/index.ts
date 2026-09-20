import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-contract'
import type { IpcApi } from '@shared/ipc-contract'

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(channel, ...args)

function subscribe(channel: string, callback: (...args: unknown[]) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => callback(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: IpcApi = {
  projects: {
    list: (filter) => invoke(IPC_CHANNELS['projects:list'], filter) as ReturnType<IpcApi['projects']['list']>,
    get: (id) => invoke(IPC_CHANNELS['projects:get'], id) as ReturnType<IpcApi['projects']['get']>,
    create: (input) => invoke(IPC_CHANNELS['projects:create'], input) as ReturnType<IpcApi['projects']['create']>,
    update: (id, patch) =>
      invoke(IPC_CHANNELS['projects:update'], id, patch) as ReturnType<IpcApi['projects']['update']>,
    archive: (id) => invoke(IPC_CHANNELS['projects:archive'], id) as ReturnType<IpcApi['projects']['archive']>,
    restore: (id) => invoke(IPC_CHANNELS['projects:restore'], id) as ReturnType<IpcApi['projects']['restore']>,
    complete: (id) => invoke(IPC_CHANNELS['projects:complete'], id) as ReturnType<IpcApi['projects']['complete']>,
    reopen: (id) => invoke(IPC_CHANNELS['projects:reopen'], id) as ReturnType<IpcApi['projects']['reopen']>,
    deletePreview: (id) =>
      invoke(IPC_CHANNELS['projects:deletePreview'], id) as ReturnType<IpcApi['projects']['deletePreview']>,
    delete: (id) => invoke(IPC_CHANNELS['projects:delete'], id) as ReturnType<IpcApi['projects']['delete']>,
    exportCsv: (id) => invoke(IPC_CHANNELS['projects:exportCsv'], id) as ReturnType<IpcApi['projects']['exportCsv']>
  },
  subtasks: {
    listForProject: (projectId) =>
      invoke(IPC_CHANNELS['subtasks:listForProject'], projectId) as ReturnType<
        IpcApi['subtasks']['listForProject']
      >,
    create: (input) => invoke(IPC_CHANNELS['subtasks:create'], input) as ReturnType<IpcApi['subtasks']['create']>,
    update: (id, patch) =>
      invoke(IPC_CHANNELS['subtasks:update'], id, patch) as ReturnType<IpcApi['subtasks']['update']>,
    reorder: (projectId, orderedIds) =>
      invoke(IPC_CHANNELS['subtasks:reorder'], projectId, orderedIds) as ReturnType<
        IpcApi['subtasks']['reorder']
      >,
    complete: (id) => invoke(IPC_CHANNELS['subtasks:complete'], id) as ReturnType<IpcApi['subtasks']['complete']>,
    archive: (id) => invoke(IPC_CHANNELS['subtasks:archive'], id) as ReturnType<IpcApi['subtasks']['archive']>,
    deletePreview: (id) =>
      invoke(IPC_CHANNELS['subtasks:deletePreview'], id) as ReturnType<IpcApi['subtasks']['deletePreview']>,
    delete: (id) => invoke(IPC_CHANNELS['subtasks:delete'], id) as ReturnType<IpcApi['subtasks']['delete']>
  },
  timer: {
    getActive: () => invoke(IPC_CHANNELS['timer:getActive']) as ReturnType<IpcApi['timer']['getActive']>,
    start: (projectId, subtaskId) =>
      invoke(IPC_CHANNELS['timer:start'], projectId, subtaskId) as ReturnType<IpcApi['timer']['start']>,
    confirmSwitchAndStart: (projectId, subtaskId) =>
      invoke(IPC_CHANNELS['timer:confirmSwitchAndStart'], projectId, subtaskId) as ReturnType<
        IpcApi['timer']['confirmSwitchAndStart']
      >,
    pause: () => invoke(IPC_CHANNELS['timer:pause']) as ReturnType<IpcApi['timer']['pause']>,
    resume: (projectId, subtaskId) =>
      invoke(IPC_CHANNELS['timer:resume'], projectId, subtaskId) as ReturnType<IpcApi['timer']['resume']>,
    stop: () => invoke(IPC_CHANNELS['timer:stop']) as ReturnType<IpcApi['timer']['stop']>,
    checkCrashRecovery: () =>
      invoke(IPC_CHANNELS['timer:checkCrashRecovery']) as ReturnType<IpcApi['timer']['checkCrashRecovery']>,
    resolveCrashRecovery: (choice) =>
      invoke(IPC_CHANNELS['timer:resolveCrashRecovery'], choice) as ReturnType<
        IpcApi['timer']['resolveCrashRecovery']
      >,
    checkSleepResume: () =>
      invoke(IPC_CHANNELS['timer:checkSleepResume']) as ReturnType<IpcApi['timer']['checkSleepResume']>,
    resolveSleepResume: (shouldResume) =>
      invoke(IPC_CHANNELS['timer:resolveSleepResume'], shouldResume) as ReturnType<
        IpcApi['timer']['resolveSleepResume']
      >
  },
  entries: {
    createManual: (input) =>
      invoke(IPC_CHANNELS['entries:createManual'], input) as ReturnType<IpcApi['entries']['createManual']>,
    checkOverlap: (projectId, startedAt, endedAt) =>
      invoke(IPC_CHANNELS['entries:checkOverlap'], projectId, startedAt, endedAt) as ReturnType<
        IpcApi['entries']['checkOverlap']
      >,
    update: (input) => invoke(IPC_CHANNELS['entries:update'], input) as ReturnType<IpcApi['entries']['update']>,
    delete: (id) => invoke(IPC_CHANNELS['entries:delete'], id) as ReturnType<IpcApi['entries']['delete']>,
    history: (filter) => invoke(IPC_CHANNELS['entries:history'], filter) as ReturnType<IpcApi['entries']['history']>,
    listForProject: (projectId, filter) =>
      invoke(IPC_CHANNELS['entries:listForProject'], projectId, filter) as ReturnType<
        IpcApi['entries']['listForProject']
      >
  },
  dashboard: {
    summary: () => invoke(IPC_CHANNELS['dashboard:summary']) as ReturnType<IpcApi['dashboard']['summary']>
  },
  reports: {
    totals: (filter) => invoke(IPC_CHANNELS['reports:totals'], filter) as ReturnType<IpcApi['reports']['totals']>
  },
  tags: {
    list: () => invoke(IPC_CHANNELS['tags:list']) as ReturnType<IpcApi['tags']['list']>,
    listForProject: (projectId) =>
      invoke(IPC_CHANNELS['tags:listForProject'], projectId) as ReturnType<IpcApi['tags']['listForProject']>,
    create: (name) => invoke(IPC_CHANNELS['tags:create'], name) as ReturnType<IpcApi['tags']['create']>,
    setForProject: (projectId, tagIds) =>
      invoke(IPC_CHANNELS['tags:setForProject'], projectId, tagIds) as ReturnType<
        IpcApi['tags']['setForProject']
      >
  },
  settings: {
    getAll: () => invoke(IPC_CHANNELS['settings:getAll']) as ReturnType<IpcApi['settings']['getAll']>,
    set: (key, value) => invoke(IPC_CHANNELS['settings:set'], key, value) as ReturnType<IpcApi['settings']['set']>
  },
  data: {
    backupDatabase: () =>
      invoke(IPC_CHANNELS['data:backupDatabase']) as ReturnType<IpcApi['data']['backupDatabase']>,
    exportJson: () => invoke(IPC_CHANNELS['data:exportJson']) as ReturnType<IpcApi['data']['exportJson']>,
    importJson: (payload) =>
      invoke(IPC_CHANNELS['data:importJson'], payload) as ReturnType<IpcApi['data']['importJson']>,
    restoreFromFile: (sourcePath) =>
      invoke(IPC_CHANNELS['data:restoreFromFile'], sourcePath) as ReturnType<
        IpcApi['data']['restoreFromFile']
      >,
    pickRestoreFile: () =>
      invoke(IPC_CHANNELS['data:pickRestoreFile']) as ReturnType<IpcApi['data']['pickRestoreFile']>,
    loadSeedData: () => invoke(IPC_CHANNELS['data:loadSeedData']) as ReturnType<IpcApi['data']['loadSeedData']>,
    removeSeedData: () =>
      invoke(IPC_CHANNELS['data:removeSeedData']) as ReturnType<IpcApi['data']['removeSeedData']>,
    getDbPath: () => invoke(IPC_CHANNELS['data:getDbPath']) as ReturnType<IpcApi['data']['getDbPath']>
  },
  shortcuts: {
    getRegistrationErrors: () =>
      invoke(IPC_CHANNELS['shortcuts:getRegistrationErrors']) as ReturnType<
        IpcApi['shortcuts']['getRegistrationErrors']
      >
  },
  events: {
    onTimerChanged: (callback) => subscribe(IPC_CHANNELS['events:timerChanged'], callback),
    onSleepResumeNeeded: (callback) =>
      subscribe(IPC_CHANNELS['events:sleepResumeNeeded'], callback as (...args: unknown[]) => void)
  }
}

contextBridge.exposeInMainWorld('api', api)
