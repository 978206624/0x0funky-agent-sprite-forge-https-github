// Phase 3 功能验证：scanSkills 识别 skill / 适配标记 / 跳过规则 / frontmatter 解析 / 错误态。
// esbuild 打包 + node 运行（scanner 无原生依赖）。非生产代码，不纳入 tsconfig include。
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { scanSkills } from '../src/main/skills/scanner'

let passed = 0
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('FAIL: ' + msg)
    process.exit(1)
  }
  passed++
  console.log('PASS: ' + msg)
}

const root = mkdtempSync(join(tmpdir(), 'gaf-skills-'))
function mkSkill(id: string, skillMd: string | null): void {
  mkdirSync(join(root, id), { recursive: true })
  if (skillMd !== null) writeFileSync(join(root, id, 'SKILL.md'), skillMd)
}

// 已适配 skill：description 含冒号 + 双引号（验证不被冒号截断、引号被剥离）
mkSkill(
  'generate2dsprite',
  '---\nname: generate2dsprite\ndescription: "Generate sprites: pixel-art, NPCs, spells"\n---\n# body\n'
)
// 未适配 skill：CRLF frontmatter + 单引号
mkSkill('generate2dmap', "---\r\nname: generate2dmap\r\ndescription: 'Maps: tiles'\r\n---\r\n# body\r\n")
// 未适配 skill：无 frontmatter（name/description 回退）
mkSkill('bare-skill', '# 没有 frontmatter 的 SKILL.md\n')
// 跳过：无 SKILL.md 的目录
mkSkill('no-skillmd', null)
// 跳过：以 . 开头的隐藏目录
mkSkill('.system', '---\nname: sys\n---\n')
// 跳过：非目录项
writeFileSync(join(root, 'loose-file.txt'), 'not a dir')

const r = scanSkills(root)
assert(r.rootExists === true && r.error === null, '根目录存在、无错误')

const byId = new Map(r.skills.map((s) => [s.id, s]))
assert(byId.has('generate2dsprite'), '识别 generate2dsprite')
assert(byId.has('generate2dmap'), '识别 generate2dmap')
assert(byId.has('bare-skill'), '识别无 frontmatter 的 skill')
assert(!byId.has('no-skillmd'), '跳过无 SKILL.md 的目录')
assert(!byId.has('.system'), '跳过 . 开头隐藏目录')
assert(!byId.has('loose-file.txt'), '跳过非目录项')
assert(r.skills.length === 3, '恰好 3 个有效 skill')

const sprite = byId.get('generate2dsprite')!
assert(sprite.adapted === true, 'generate2dsprite 标记已适配')
assert(sprite.name === 'generate2dsprite', 'name 解析正确')
assert(sprite.description === 'Generate sprites: pixel-art, NPCs, spells', 'description 含冒号不截断 + 去引号')

const map = byId.get('generate2dmap')!
assert(map.adapted === false, 'generate2dmap 标记未适配')
assert(map.description === 'Maps: tiles', 'CRLF + 单引号 description 解析正确')

const bare = byId.get('bare-skill')!
assert(bare.name === 'bare-skill', '无 frontmatter 时 name 回退目录名')
assert(bare.description === null, '无 frontmatter 时 description 为 null')

assert(r.skills[0].adapted === true, '排序：已适配置顶')

// 不存在的根目录 → rootExists=false + error
const missing = scanSkills(join(root, 'does-not-exist'))
assert(missing.rootExists === false && missing.skills.length === 0 && !!missing.error, '根目录缺失返回结构化错误态')

rmSync(root, { recursive: true, force: true })
console.log(`\n✅ skills smoke 全过：${passed} 项`)
