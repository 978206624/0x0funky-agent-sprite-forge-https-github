import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { resolveCodexPath } from '../codex/resolver'
import { getCurrentProject } from '../projects/manager'
import { runGeneration, type RunGenerationHandle } from '../generation/runner'
import { tryAcquire, release } from '../generation/lock'
import { getGenDefaults, getEffectiveSandbox, coerceEffort } from '../settings/service'
import { maskSecrets, maskEvent } from '../../shared/mask'
import type { CodexEvent, GenParams, GenerationRecord } from '../../shared/types'

/** gen:start 成功返回：本次生成的记录 id 与 slug（最终记录经 gen:done 事件回传）。 */
export interface GenStartResult {
  generationId: number
  slug: string
}

/** 当前进行中的生成（MVP 单并发：一次一个，按钮态在生成中变取消）。 */
let active: RunGenerationHandle | null = null

/** 仅在目标 webContents 仍存活时推送，避免向已销毁窗口发送。 */
function safeSend(wc: WebContents, channel: string, payload: unknown): void {
  if (!wc.isDestroyed()) wc.send(channel, payload)
}

/** 注册生成相关 IPC。须在 app ready 且 initDatabase() 之后调用一次。 */
export function registerGenerationIpc(): void {
  ipcMain.handle('gen:start', async (e: IpcMainInvokeEvent, params: GenParams): Promise<GenStartResult> => {
    // 与 chat:send 共用同一把锁：同步抢占，避免「检查通过 → await 期间第二个 invoke 又通过」启动双任务。
    if (!tryAcquire()) throw new Error('已有任务进行中，请先取消或等待完成')
    try {
      const project = getCurrentProject()
      if (!project) throw new Error('未选择当前项目')
      const binPath = await resolveCodexPath()
      if (!binPath) throw new Error('未找到 codex 可执行文件（检查安装或 CODEX_BIN）')

      const wc = e.sender
      // 生成默认值在 IPC seam（composition root）注入：读 settings 默认 + 安全 clamp。
      // params.sandbox 优先（未来可 per-gen 覆盖），无则用默认；danger 未授权时降级并记日志。
      const defaults = getGenDefaults()
      const { sandbox, downgraded } = getEffectiveSandbox(params.sandbox ?? defaults.sandbox)
      if (downgraded) {
        safeSend(wc, 'gen:stderr', '已按安全设置将 sandbox 降级为 workspace-write（danger-full-access 未授权）\n')
      }
      const handle = runGeneration({
        projectId: project.id,
        projectDir: project.absPath,
        binPath,
        params,
        sandbox,
        // model 自由文本（codex 接受任意模型名）只 trim；effort 必经白名单（防任意串拼进 -c）。
        model: params.model?.trim() || defaults.model,
        effort: coerceEffort(params.effort) ?? defaults.effort,
        // 事件流与 stderr 推渲染层前都脱敏，防凭据上屏/进日志/进 devtools。
        onEvent: (ev: CodexEvent) => safeSend(wc, 'gen:event', maskEvent(ev)),
        onStderr: (chunk: string) => safeSend(wc, 'gen:stderr', maskSecrets(chunk))
      })
      active = handle

      // runner 保证 done 不 reject；仍防御 DB/IO 异常 reject，finally 必清 active + 释放锁不堵后续。
      void handle.done
        .then((record: GenerationRecord) => safeSend(wc, 'gen:done', record))
        .catch((err: unknown) => safeSend(wc, 'gen:stderr', `生成结束异常：${String(err)}\n`))
        .finally(() => {
          if (active === handle) active = null
          release()
        })

      return { generationId: handle.generationId, slug: handle.slug }
    } catch (err) {
      // 启动阶段（未进入 handle.done.finally）失败：就地释放锁，否则后续任务永久被挡。
      release()
      throw err
    }
  })

  ipcMain.handle('gen:cancel', (): void => {
    active?.cancel()
  })
}
