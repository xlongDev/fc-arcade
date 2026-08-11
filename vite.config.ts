import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    cssTarget: 'chrome111',
    chunkSizeWarningLimit: 900,
    sourcemap: false,
    /**
     * AudioWorklet 处理器绝不能被内联成 data: URI。
     *
     * 默认 assetsInlineLimit 是 4096 字节，小于它的资源会变成
     * `data:text/javascript;base64,...`，而 `audioWorklet.addModule()` 加载
     * data URI 在部分浏览器上会直接抛 `AbortError: Unable to load a worklet's module`
     * （参见 vitejs/vite#6979）。更糟的是它只在生产构建里出现：dev 走的是真实 URL，
     * 本地永远测不出来，上线才炸。
     *
     * 调用点已经写了 `?url&no-inline` 显式声明，这里再兜一层，
     * 防止以后有人手滑把后缀删了。
     */
    assetsInlineLimit(filePath) {
      if (filePath.includes('audio-processor')) return false
      return undefined
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  worker: {
    format: 'es',
  },
})
