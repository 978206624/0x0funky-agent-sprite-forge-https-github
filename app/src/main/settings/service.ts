import { getDb } from '../db'
import { getSetting } from '../db/settings-repo'
import {
  SETTINGS_KEYS,
  SETTINGS_DEFAULTS,
  SETTING_TRUE,
  SANDBOX_MODES,
  EFFORTS,
  type CodexSandbox,
  type SettingsKey
} from '../../shared/settings-keys'

/**
 * 设置读取服务（主进程）：在 settings-repo 之上做类型化、带默认值兜底的读取。
 * 全部 defensive——DB 未初始化 / 坏值 / 异常一律回退 SETTINGS_DEFAULTS，
 * 绝不让一条脏设置搞挂 codex 检测或生成链路。不缓存：改设置后即时生效。
 */

/** 读单个设置；缺失/异常回退默认值。 */
function read(key: SettingsKey): string {
  try {
    const v = getSetting(getDb(), key)
    return v ?? SETTINGS_DEFAULTS[key]
  } catch {
    return SETTINGS_DEFAULTS[key]
  }
}

/** trim 后的字符串值；空串返回 undefined（表示"未配置/交下游推断"）。 */
function readOptional(key: SettingsKey): string | undefined {
  const v = read(key).trim()
  return v || undefined
}

/** 校验值在白名单内，否则回退 fallback。 */
function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/**
 * 规范化 reasoning effort：trim 后必须在 EFFORTS 白名单内，否则返回 undefined（视为未配置）。
 * 任意来源（settings 默认 / per-request params）的 effort 都须经此，杜绝任意串拼进 codex `-c`。
 */
export function coerceEffort(raw?: string | null): string | undefined {
  const v = (raw ?? '').trim()
  return (EFFORTS as readonly string[]).includes(v) ? v : undefined
}

/** 生成默认值：model/effort 空=交给 codex 自身默认；sandbox 必为合法枚举。 */
export function getGenDefaults(): {
  model: string | undefined
  effort: string | undefined
  sandbox: CodexSandbox
} {
  const model = readOptional(SETTINGS_KEYS.genModel)
  // effort 给了就必须合法，非法当未配置（避免把脏值塞进 -c）。
  const effort = coerceEffort(read(SETTINGS_KEYS.genEffort))
  const sandbox = oneOf(read(SETTINGS_KEYS.genSandbox), SANDBOX_MODES, 'workspace-write')
  return { model, effort, sandbox }
}

/** 是否允许 danger-full-access。 */
export function isDangerAllowed(): boolean {
  return read(SETTINGS_KEYS.allowDanger) === SETTING_TRUE
}

/**
 * 安全 clamp：主进程权威兜底（不信任 renderer）。
 * 请求 danger-full-access 但未开启 allowDanger → 降级为 workspace-write，并标记 downgraded
 * 供调用方记一条日志。其余原样返回（非法值也收敛到合法枚举）。
 */
export function getEffectiveSandbox(requested?: string): {
  sandbox: CodexSandbox
  downgraded: boolean
} {
  const req = oneOf(requested ?? '', SANDBOX_MODES, getGenDefaults().sandbox)
  if (req === 'danger-full-access' && !isDangerAllowed()) {
    return { sandbox: 'workspace-write', downgraded: true }
  }
  return { sandbox: req, downgraded: false }
}

/** codex 可执行文件自定义路径；未配置返回 undefined。 */
export function getCodexBinOverride(): string | undefined {
  return readOptional(SETTINGS_KEYS.codexBinOverride)
}

/** skill 扫描目录自定义路径；未配置返回 undefined。 */
export function getSkillsDirOverride(): string | undefined {
  return readOptional(SETTINGS_KEYS.skillsDirOverride)
}
