export interface ForgeApi {
  // 后续 Phase 扩展：codex、skills、db、generation、chat、settings
}

declare global {
  interface Window {
    api: ForgeApi
  }
}
