import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Emscripten module uses import.meta.url to locate picoruby.wasm;
    // pre-bundling would rewrite it and break the resolution.
    exclude: ['@picoruby/wasm-wasi'],
  },
})
