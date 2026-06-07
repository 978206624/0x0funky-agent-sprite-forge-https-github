import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { TextArea } from '../../ui/text-input'
import { Button } from '../../ui/button'
import { Select } from '../../ui/select'

interface SkillEditorProps {
  skillId: string
  onClose: () => void
  /** 上报当前是否有未保存改动，供父组件在切换编辑目标前拦截（M4 防丢）。 */
  onDirtyChange?: (dirty: boolean) => void
}

/**
 * skill 内容编辑器：列出该 skill 目录内可编辑文件（默认 SKILL.md），读入 TextArea 编辑、保存写回。
 * 首版聚焦文本编辑，不做语法高亮 / 多文件树。
 */
export function SkillEditor({ skillId, onClose, onDirtyChange }: SkillEditorProps) {
  const [files, setFiles] = useState<string[]>([])
  const [file, setFile] = useState<string>('')
  const [content, setContent] = useState('')
  // 已落盘内容基线：dirty 判定 = content !== savedContent。
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = content !== savedContent

  // 上报 dirty 给父组件（用于拦截"点另一个 skill 的编辑按钮"绕过确认的丢失）。
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  // 切 skill：先清空 file/content（消除「新 skillId + 旧 file」的读取竞态 M3），
  // 再拉文件清单并选定默认 SKILL.md（无则首个）。
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setFile('')
    setContent('')
    setSavedContent('')
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

  // 切文件：读内容并设为基线（file 为空时不读，避免竞态）。
  useEffect(() => {
    if (!file) {
      setContent('')
      setSavedContent('')
      return
    }
    let alive = true
    setSaved(false)
    setError(null)
    void window.api.skills
      .readFile(skillId, file)
      .then((c) => {
        if (!alive) return
        setContent(c)
        setSavedContent(c)
      })
      .catch((e) => alive && setError(`读取文件失败：${String(e)}`))
    return () => {
      alive = false
    }
  }, [skillId, file])

  // 切文件前若有未保存改动，二次确认（M4 防丢）。
  const onSelectFile = (next: string): void => {
    if (next === file) return
    if (dirty && !window.confirm('当前文件有未保存的修改，切换将丢失。确定继续？')) return
    setFile(next)
  }

  // 关闭前若有未保存改动，二次确认（M4 防丢）。
  const onCloseGuarded = (): void => {
    if (dirty && !window.confirm('有未保存的修改，关闭将丢失。确定关闭？')) return
    onClose()
  }

  const save = (): void => {
    if (saving || !file) return // 防连点（m3）
    setError(null)
    setSaving(true)
    void window.api.skills
      .writeFile(skillId, file, content)
      .then(() => {
        setSavedContent(content) // 保存成功 → 更新基线，dirty 归零
        setSaved(true)
        window.setTimeout(() => setSaved(false), 2000)
      })
      .catch((e) => setError(`保存失败：${String(e)}`))
      .finally(() => setSaving(false))
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-edge bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[12px] font-medium text-fg">编辑 {skillId}</span>
          {files.length > 0 && (
            <Select
              ariaLabel="选择文件"
              value={file}
              onChange={onSelectFile}
              options={files.map((f) => ({ value: f, label: f }))}
              className="w-[200px]"
            />
          )}
          {dirty && <span className="shrink-0 text-[11px] text-fg-dim">● 未保存</span>}
        </div>
        <button
          type="button"
          onClick={onCloseGuarded}
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
        <Button variant="primary" onClick={save} disabled={loading || saving || !file || !dirty}>
          {saving ? '保存中…' : '保存'}
        </Button>
        {saved && <span className="text-[11px] text-success">已保存</span>}
      </div>
    </div>
  )
}
