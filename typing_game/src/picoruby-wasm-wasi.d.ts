declare module '@picoruby/wasm-wasi/picoruby.js' {
  interface EmscriptenModule {
    ccall: (
      name: string,
      returnType: string | null,
      argTypes: string[],
      args: unknown[],
      opts?: { async?: boolean }
    ) => unknown
  }

  type CreateModule = (opts?: Record<string, unknown>) => Promise<EmscriptenModule>

  const createModule: CreateModule
  export default createModule
}
