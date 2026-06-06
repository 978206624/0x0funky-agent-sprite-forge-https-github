// Phase 8 功能验证：exportBundle 复制整套 bundle + 安全边界（slug 逃逸 / 自我递归 / 源缺失）。
// esbuild 打包 + ELECTRON_RUN_AS_NODE 运行（与其它 smoke 一致；exporter 无原生依赖）。
// 非生产代码，不纳入 tsconfig include。
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { exportBundle } from '../src/main/generation/exporter'

let passed = 0
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('FAIL: ' + msg)
    process.exit(1)
  }
  passed++
  console.log('PASS: ' + msg)
}
async function assertThrows(fn: () => Promise<unknown>, msg: string): Promise<void> {
  try {
    await fn()
    console.error('FAIL（未抛错）: ' + msg)
    process.exit(1)
  } catch {
    passed++
    console.log('PASS: ' + msg)
  }
}

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'gaf-export-'))

  // 构造产物 bundle 目录 <root>/project/assets/sprites/walk-01/（含一层子目录）
  const slug = 'walk-01'
  const spritesDir = join(root, 'project', 'assets', 'sprites')
  const outputDir = join(spritesDir, slug)
  mkdirSync(outputDir, { recursive: true })
  const files = [
    'sheet-transparent.png',
    `${slug}-1.png`,
    'animation.gif',
    'pipeline-meta.json',
    'phaser-example.js',
    'README.md'
  ]
  for (const f of files) writeFileSync(join(outputDir, f), `data:${f}`)
  mkdirSync(join(outputDir, 'sub'))
  writeFileSync(join(outputDir, 'sub', 'x.txt'), 'nested')

  // 1) Happy path：导出到 <root>/exported/
  const destRoot = join(root, 'exported')
  mkdirSync(destRoot)
  const dest = await exportBundle({ outputDir, slug, destRoot })
  assert(dest === join(destRoot, slug), '返回目标目录 = <destRoot>/<slug>')
  for (const f of files) assert(existsSync(join(dest, f)), `复制了 ${f}`)
  assert(
    readFileSync(join(dest, `${slug}-1.png`), 'utf8') === `data:${slug}-1.png`,
    '文件内容一致'
  )
  assert(existsSync(join(dest, 'sub', 'x.txt')), '递归复制了子目录文件')
  assert(!existsSync(join(dest, slug)), '未多嵌套一层 <slug>/<slug>')

  // 2) 覆盖合并：再次导出不报错
  await exportBundle({ outputDir, slug, destRoot })
  assert(existsSync(join(dest, 'README.md')), '重复导出（覆盖合并）成功')

  // 3) slug 逃逸校验（路径分隔符 / . / .. / 空串一律拒绝）
  for (const bad of ['../evil', 'a/b', 'a\\b', '', '.', '..']) {
    await assertThrows(
      () => exportBundle({ outputDir, slug: bad, destRoot }),
      `拒绝非法 slug: ${JSON.stringify(bad)}`
    )
  }

  // 4) 防自我递归：dest 落在 src 内 / dest 等于 src
  await assertThrows(
    () => exportBundle({ outputDir, slug: 'inner', destRoot: outputDir }),
    '拒绝导出到产物目录子目录（dest 在 src 内）'
  )
  await assertThrows(
    () => exportBundle({ outputDir, slug, destRoot: spritesDir }),
    '拒绝导出目标等于产物目录自身'
  )

  // 5) 源目录不存在
  await assertThrows(
    () => exportBundle({ outputDir: join(root, 'nope'), slug, destRoot }),
    '源目录不存在时抛错'
  )

  rmSync(root, { recursive: true, force: true })
  console.log(`\n✅ exporter smoke 全过：${passed} 项`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
