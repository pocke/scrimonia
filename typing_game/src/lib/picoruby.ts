// PicoRuby.wasm の初期化と Ruby コード実行を管理する

import type createModuleType from '@picoruby/wasm-wasi/picoruby.js'

type EmscriptenModule = Awaited<ReturnType<typeof createModuleType>>

// モジュールを使い回して picorb_init を呼び直すと、mrbc_init がクラスと
// メソッドを初期化する一方で、gem の読み込み済みフラグ (C の static 変数) は
// 残る。そのため 2 回目以降は gem の初期化が飛ばされ、respond_to? や require
// が消えた VM になるので、モジュールは使い回さない。
async function loadModule(): Promise<EmscriptenModule> {
  const { default: createModule } = await import(
    /* @vite-ignore */ '@picoruby/wasm-wasi/picoruby.js'
  )
  return await createModule()
}

/**
 * PicoRuby.wasm を初期化し、Ruby ソースコードを実行する。
 * isDone コールバックが true を返したら resolve する。
 *
 * PicoRuby.wasm の js gem はイベントループを維持するため、
 * mrbc_run_step が < 0 (全タスク終了) を返すことがない。
 * そのため、タスク終了ではなく isDone で完了を判定する。
 */
export async function executeRuby(source: string, isDone: () => boolean): Promise<void> {
  const Module = await loadModule()

  Module.ccall('picorb_init', 'number', [], [])
  Module.ccall('picorb_create_task', 'number', ['string'], [source])

  return new Promise<void>((resolve, reject) => {
    const MRBC_TICK_UNIT = 8.1
    const MAX_STEPS = 100_000
    let lastTime = performance.now()
    let stepCount = 0

    function run() {
      const currentTime = performance.now()
      if (MRBC_TICK_UNIT <= currentTime - lastTime) {
        Module.ccall('mrbc_tick', null, [], [])
        lastTime = currentTime
      }

      const result = Module.ccall('mrbc_run_step', 'number', [], []) as number
      stepCount++

      if (isDone()) {
        resolve()
        return
      }
      if (result < 0) {
        resolve()
        return
      }
      if (stepCount >= MAX_STEPS) {
        reject(new Error(`PicoRuby の実行が ${MAX_STEPS} ステップを超えました`))
        return
      }
      setTimeout(run, 0)
    }
    run()
  })
}
