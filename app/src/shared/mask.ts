/**
 * 密钥脱敏：把可能泄漏的凭据从展示文本中抹掉。
 * 最可能泄漏点是 `codex login status` 输出（→ CodexHealth.error）与 codex stderr 诊断。
 * 在主进程推给渲染层前应用（纵深防御——渲染层 / devtools / 日志都拿不到明文）。
 * 只针对已知凭据形态做保守替换，避免误伤正常文本。
 */
export function maskSecrets(text: string): string {
  if (!text) return text
  return (
    text
      // OpenAI 风格密钥：sk-... / sk-proj-...
      .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, 'sk-***')
      // Bearer / token 头：保留前缀，抹掉值
      .replace(/\b(Bearer)\s+[A-Za-z0-9._-]{8,}/gi, '$1 ***')
      // 带前缀的 *_API_KEY 形态（如 OPENAI_API_KEY=xxx、XYZ-API-KEY: xxx）：保留键，抹掉值
      .replace(
        /\b([A-Z0-9]+[_-])?API[_-]?KEY\b(["'\s:=]+)[^\s"',]{6,}/gi,
        (_m, pre: string | undefined, sep: string) => `${pre ?? ''}API_KEY${sep}***`
      )
      // api_key / token / secret / password = <value> 形态：保留键与分隔符，抹掉值
      .replace(
        /\b(api[_-]?key|token|secret|password)\b(["'\s:=]+)[^\s"',]{6,}/gi,
        (_m, key: string, sep: string) => `${key}${sep}***`
      )
  )
}

/**
 * 递归脱敏：对对象/数组里每个 string 值直接调 maskSecrets。
 * 不在 JSON 字符串上跑正则——JSON.stringify 会把字段内引号转义成 `\"`，破坏 key=value 形态的匹配。
 */
function maskDeep(v: unknown): unknown {
  if (typeof v === 'string') return maskSecrets(v)
  if (Array.isArray(v)) return v.map(maskDeep)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = maskDeep(val)
    return out
  }
  return v
}

/**
 * 对 codex 事件做脱敏后再推渲染层（stdout JSON 事件流里 agent_message.text /
 * command_execution.aggregated_output / error.message / unknown.raw 等字段都可能含凭据）。
 * 递归遍历每个字符串字段直接脱敏，结构与非字符串字段原样保留。
 */
export function maskEvent<T>(event: T): T {
  return maskDeep(event) as T
}
