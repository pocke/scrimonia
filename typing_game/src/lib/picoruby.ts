// PicoRuby.wasm の初期化と Ruby コード実行を管理する

import type createModuleType from '@picoruby/wasm-wasi/picoruby.js'

type EmscriptenModule = Awaited<ReturnType<typeof createModuleType>>

let modulePromise: Promise<EmscriptenModule> | null = null

function loadModule(): Promise<EmscriptenModule> {
  if (modulePromise) return modulePromise

  modulePromise = (async () => {
    const { default: createModule } = await import(
      /* @vite-ignore */ '@picoruby/wasm-wasi/picoruby.js'
    )
    return await createModule()
  })()

  return modulePromise
}

/**
 * PicoRuby.wasm を初期化し、Ruby ソースコードを実行する。
 * タスクが完了（全タスクが dormant）したら resolve する。
 */
export async function executeRuby(source: string): Promise<void> {
  const Module = await loadModule()

  Module.ccall('picorb_init', 'number', [], [])
  Module.ccall('picorb_create_task', 'number', ['string'], [source])

  return new Promise<void>((resolve) => {
    const MRBC_TICK_UNIT = 8.1
    let lastTime = performance.now()

    function run() {
      const currentTime = performance.now()
      if (MRBC_TICK_UNIT <= currentTime - lastTime) {
        Module.ccall('mrbc_tick', null, [], [])
        lastTime = currentTime
      }
      const result = Module.ccall('mrbc_run_step', 'number', [], [], { async: true }) as number
      if (result < 0) {
        resolve()
        return
      }
      setTimeout(run, 0)
    }
    run()
  })
}
