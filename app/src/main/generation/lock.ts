/**
 * 全局 codex 任务互斥锁（参数生成 gen:start 与对话 chat:send 共用）。
 *
 * 为什么需要：二者都在同一项目目录 spawn codex 写 assets/sprites/<slug>/。若放任并发：
 * ① slug.uniqueSlug 只读已落库/落盘的占用、不预留，两个任务可能算出同一 slug 互相覆盖；
 * ② 两个 codex 进程（各自 image_gen + 20min 超时）重负；
 * ③ 状态条「切项目」禁用守卫只看 generation-store.status，看不到第二个 runner。
 * 一把进程级锁一次只放行一个 codex 任务，从根上消除以上三点。
 *
 * 单窗口单用户工具：模块级布尔即可，无需跨进程文件锁。各 IPC 仍保留自己的 active 句柄用于 cancel 路由。
 */

let busy = false

/** 是否有 codex 任务进行中。 */
export function isBusy(): boolean {
  return busy
}

/** 尝试占用：成功（之前空闲）返回 true 并置忙；已忙返回 false。 */
export function tryAcquire(): boolean {
  if (busy) return false
  busy = true
  return true
}

/** 释放锁（任务结束后调用，须配对 tryAcquire）。 */
export function release(): void {
  busy = false
}
