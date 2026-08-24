import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// 纯函数单测用 node 环境即可，不加载 react / tailwind 插件，
// 避免给 metadata 叶子模块的无谓开销。@ 别名与 vite.config 保持一致。
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    typecheck: { enabled: false },
  },
})
