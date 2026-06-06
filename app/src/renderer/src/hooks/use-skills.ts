import type { SkillInfo } from '@shared/types'
import { useSkillStore } from '../store/skill-store'

export interface UseSkills {
  skills: SkillInfo[]
  currentId: string | null
  setCurrent: (id: string) => void
  loading: boolean
  /** 扫描根目录是否存在可读（false 时展示目录缺失态）。 */
  rootExists: boolean
  /** 扫描错误（根目录缺失/IPC 失败等）；无则 null。 */
  error: string | null
}

/** 读 skill-store 派生 Skill 库视图（列表 + 当前选中 + 状态）。扫描由 App 启动时触发一次。 */
export function useSkills(): UseSkills {
  const result = useSkillStore((s) => s.result)
  const loading = useSkillStore((s) => s.loading)
  const currentId = useSkillStore((s) => s.currentId)
  const setCurrent = useSkillStore((s) => s.setCurrent)

  return {
    skills: result?.skills ?? [],
    currentId,
    setCurrent,
    loading,
    rootExists: result?.rootExists ?? false,
    error: result?.error ?? null
  }
}
