// 设置项单一事实源（主进程 / preload / 渲染层三层共用）。
// 仿 shared/types.ts 的 GENERATION_STATUSES / CHAT_ROLES：键名、默认值、枚举集中此处，不漂移。

/** codex sandbox 模式（codex exec -s 的合法值）。 */
export const SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'] as const
export type CodexSandbox = (typeof SANDBOX_MODES)[number]

/** codex reasoning effort（经 -c model_reasoning_effort=<v> 注入）。 */
export const EFFORTS = ['minimal', 'low', 'medium', 'high'] as const
export type CodexEffort = (typeof EFFORTS)[number]

/**
 * settings 表的键名常量。值为稳定字符串，渲染层写、主进程读，禁止散落字面量。
 * 命名用点分命名空间，便于分组。
 */
export const SETTINGS_KEYS = {
  /** 生成默认模型（codex --model），空=用 codex 自身默认 */
  genModel: 'gen.model',
  /** 生成默认 reasoning effort（codex -c model_reasoning_effort），空=用 codex 默认 */
  genEffort: 'gen.effort',
  /** 生成默认 sandbox 模式 */
  genSandbox: 'gen.sandbox',
  /** codex 可执行文件自定义路径（覆盖 CODEX_BIN/PATH），空=不覆盖 */
  codexBinOverride: 'codex.bin_override',
  /** skill 扫描目录自定义路径（覆盖 CODEX_SKILLS_DIR/默认），空=不覆盖 */
  skillsDirOverride: 'skills.dir_override',
  /** 是否允许 danger-full-access sandbox（默认关，'true' 为开） */
  allowDanger: 'security.allow_danger'
} as const

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS]

/** 默认值（settings 表无对应键时回退）。空字符串=交给下游推断（codex 默认 / env / 探测）。 */
export const SETTINGS_DEFAULTS: Record<SettingsKey, string> = {
  [SETTINGS_KEYS.genModel]: '',
  [SETTINGS_KEYS.genEffort]: '',
  [SETTINGS_KEYS.genSandbox]: 'workspace-write',
  [SETTINGS_KEYS.codexBinOverride]: '',
  [SETTINGS_KEYS.skillsDirOverride]: '',
  [SETTINGS_KEYS.allowDanger]: 'false'
}

/** 布尔设置的开值（settings 存字符串，统一以此判定）。 */
export const SETTING_TRUE = 'true'
