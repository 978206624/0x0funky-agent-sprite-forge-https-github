import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { TextArea } from '../../ui/text-input'
import { Button } from '../../ui/button'

interface SkillEditorProps {
  skillId: string
  onClose: () => void
}

/**
 * skill 内容编辑器：列出该 skill 目录内可编辑文件（默认 SKILL.md），读入 TextArea 编辑、保存写回。
 * 首版聚焦文本编辑，不做语法高亮 / 多文件树。
 */
export function SkillEditor({ skillId, onClose }: SkillEditorProps) {
  const [files, setFiles] = useState<string[]>([])
  const [file, setFile] = useState<string>('SKILL.md')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 切 skill：拉文件清单，默认选 SKILL.md（无则首个）。
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    void window.api.skills
      .listFiles(skillId)
      .then((fs) => {
        if (!alive) return
        setFiles(fs)
        setFile(fs.includes('SKILL.md') ? 'SKILL.md' : (fs[0] ?? ''))
      })
      .catch((e) => alive && setError(`读取文件列表失败：${String(e)}`))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [skillId])

  // 切文件：读内容。
  useEffect(() => {
    if (!file) {
      setContent('')
      return
    }
    let alive = true
    setSaved(false)
    setError(null)
    void window.api.skills
      .readFile(skillId, file)
      .then((c) => alive && setContent(c))
      .catch((e) => alive && setError(`读取文件失败：${String(e)}`))
    return () => {
      alive = false
    }
  }, [skillId, file])

  const save = (): void => {
    setError(null)
    void window.api.skills
      .writeFile(skillId, file, content)
      .then(() => {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 2000)
      })
      .catch((e) => setError(`保存失败：${String(e)}`))
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-edge bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[12px] font-medium text-fg">编辑 {skillId}</span>
          {files.length > 0 && (
            <select
              value={file}
              onChange={(e) => setFile(e.target.value)}
              className="max-w-[200px] truncate rounded-sm border border-edge bg-panel px-2 py-1 text-[11px] text-fg-soft outline-none focus:border-accent"
            >
              {files.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          title="关闭编辑器"
          className="rounded-sm p-1 text-fg-dim hover:bg-hover hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && <span className="text-[11px] text-error">{error}</span>}

      <TextArea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading || !file}
        spellCheck={false}
        className="h-64 font-mono text-[11px]"
      />

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={loading || !file}>
          保存
        </Button>
        {saved && <span className="text-[11px] text-success">已保存</span>}
      </div>
    </div>
  )
}
