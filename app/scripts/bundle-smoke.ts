// Phase 9 纯逻辑验证：inspectBundleLenient（对话模式 bundle 探测）+ slugify。
// 不依赖 codex / DB / electron，直接 node 跑（esbuild bundle 后）。
import { resolve } from 'path'
import { inspectBundleLenient } from '../src/main/generation/bundle'
import { slugify } from '../src/main/generation/slug'

let passed = 0
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('FAIL: ' + msg)
    process.exit(1)
  }
  passed++
  console.log('PASS: ' + msg)
}

// ---- inspectBundleLenient：真实完整 bundle（仓库 fixture）----
const fixture = resolve(__dirname, '../../outputs/fire-mage-cast')
const ok = inspectBundleLenient(fixture, 'fire-mage-cast')
assert(ok.present === true, '完整 bundle 判 present:true')
assert(ok.frames === 6, '帧数取 meta.frames 长度 = 6')
assert(ok.rows === 3 && ok.cols === 2, 'grid 取 meta 真实 rows/cols = 3×2')
assert(ok.cell === 256, 'cell 取 meta.cell_size = 256')
assert(typeof ok.thumbnail === 'string' && ok.thumbnail.endsWith('fire-mage-cast-1.png'), '缩略图指向第 1 帧')

// ---- inspectBundleLenient：目录不存在（纯聊天轮）----
const absent = inspectBundleLenient(resolve(__dirname, '../../outputs/__no_such_dir__'), 'x')
assert(absent.present === false && absent.frames === 0 && absent.thumbnail === null, '缺目录判 present:false（text-only 轮）')

// ---- inspectBundleLenient：slug 与 fixture 不符（帧 PNG 前缀对不上）→ present:false ----
const wrongSlug = inspectBundleLenient(fixture, 'wrong-slug')
assert(wrongSlug.present === false, 'slug 与帧文件前缀不符判 present:false（不误链）')

// ---- slugify ----
assert(slugify('火法师，红袍 Fire Mage!!!') === 'fire-mage', 'slugify 去非 ascii + 连字符归一')
assert(slugify('') === '', 'slugify 空串 → 空（由调用方回退 chat/sprite）')
assert(slugify('a b c d e f g').split('-').length === 5, 'slugify 至多取 5 段')

console.log(`\nALL ${passed} BUNDLE/SLUG SMOKE TESTS PASSED`)
