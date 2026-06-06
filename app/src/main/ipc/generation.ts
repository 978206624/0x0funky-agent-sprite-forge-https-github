import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { resolveCodexPath } from '../codex/resolver'
import { getCurrentProject } from '../projects/manager'
import { runGeneration, type RunGenerationHandle } from '../generation/runner'
import { tryAcquire, release } from '../generation/lock'
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
      const handle = runGeneration({
        projectId: project.id,
        projectDir: project.absPath,
        binPath,
        params,
        onEvent: (ev: CodexEvent) => safeSend(wc, 'gen:event', ev),
        onStderr: (chunk: string) => safeSend(wc, 'gen:stderr', chunk)
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
