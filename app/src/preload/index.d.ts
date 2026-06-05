import type {
  CodexHealth,
  Project,
  ProjectInput,
  GenerationRecord,
  GenerationInput,
  GenerationUpdate,
  AppSettings
} from '../shared/types'

export interface ForgeApi {
  codex: {
    /** 检测本机 codex 安装与登录状态 */
    detect: () => Promise<CodexHealth>
  }
  db: {
    projects: {
      list: () => Promise<Project[]>
      get: (id: number) => Promise<Project | null>
      create: (input: ProjectInput) => Promise<Project>
      touch: (id: number) => Promise<void>
      delete: (id: number) => Promise<void>
    }
    generations: {
      listByProject: (projectId: number) => Promise<GenerationRecord[]>
      get: (id: number) => Promise<GenerationRecord | null>
      create: (input: GenerationInput) => Promise<GenerationRecord>
      update: (id: number, patch: GenerationUpdate) => Promise<GenerationRecord | null>
    }
    settings: {
      get: (key: string) => Promise<string | null>
      set: (key: string, value: string) => Promise<void>
      getAll: () => Promise<AppSettings>
    }
  }
  // 后续 Phase 扩展：skills、generation（事件流）、chat
}

declare global {
  interface Window {
    api: ForgeApi
  }
}
