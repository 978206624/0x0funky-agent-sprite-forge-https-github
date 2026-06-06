import { Wand2 } from 'lucide-react'

/**
 * 空状态（S2）：未选历史 / 未生成时中栏的上手引导。极简文案 + 操作指引，不用插画（工具感）。
 * 遵循 codex-not-ready 的居中布局 pattern。
 */
export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-base p-6">
      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-lg border border-edge bg-elevated">
        <Wand2 className="h-9 w-9 text-fg-dim" />
      </div>
      <p className="text-xl font-semibold text-fg-soft">开始生成你的第一个精灵</p>
      <p className="max-w-md text-center text-sm leading-relaxed text-fg-dim">
        在左栏选择 <span className="text-fg-soft">generate2dsprite</span> skill，于右栏填写角色描述与参数，
        点「生成」即可；也可切到「对话」Tab 用自然语言迭代。产出会出现在左栏历史，点开即可预览。
      </p>
    </div>
  )
}
