# 完全移除 jsnes 内核 · 全部默认 fceumm

**提交：`512c25d`（main，领先 origin/main 2 个提交：`13cfe0d` + `512c25d`）**

## 做了什么
把项目唯一的实机内核收敛为 **fceumm（经 nostalgist 封装的 RetroArch WASM）**，彻底删除 jsnes 这条内核路径及其专属支撑模块。

### 删除
- `src/emulator/jsnes/`（JsnesAdapter + NesRenderer）—— 整个 jsnes 适配器目录。
- `src/emulator/audio/`（NesAudioOutput + nes-audio-processor.js）—— jsnes 专属 AudioWorklet。fceumm 的音频由 RetroArch 原生接管，不再需要自定义 worklet。
- `package.json` 里的 `jsnes` 依赖（lockfile 同步）。

### 类型 / 配置收窄
- `EmulatorCore`：`'jsnes' | 'nostalgist'` → `'nostalgist'`（单一内核标识符，保留 `nostalgist` 指加载器库，不改成 fceumm）。
- `CORE_DISPLAY_NAME`：`{ nostalgist: 'fceumm' }`。
- `defaultCore` → `'nostalgist'`；`settingsStore.CORES` → `['nostalgist']`。
- `createEmulator` 直接动态 `import('./nostalgist/NostalgistAdapter')`，去除 jsnes 分支。
- `useEmulatorSession`：移除 `alternateCore()` 与 `coreOverride` 状态；`retry` / `switchCore` 改为同核重开（bump attempt），保留顶栏「切换内核」按钮可用。

### fceumm 版本
- 联网重新拉取 `retroarch-emscripten-build@v1.22.2`（确认是上游最新 tag），解包 `public/cores/fceumm_libretro.{js,wasm}`，与既有本地化文件**字节一致**，即当前已是最新。

### 文档与构建守卫
- README / DEPLOY：去掉 jsnes、双核、AudioWorklet 内联守卫等描述；`verify:dist` 检查 1 改为「若发现 worklet 才校验 registerProcessor，否则放行」；`vite.config.ts` 移除 `assetsInlineLimit` 的 worklet 兜底。

## 关键修复（否则质量门过不了）
移除 jsnes 后 `NesAudioOutput` 成为孤儿 → 自定义 worklet 不再产出 → `verify:dist` 的「AudioWorklet 必须独立文件」检查失败。**修复：删 audio 模块 + 同步清理 vite/verify 守卫。**

## 质量门（全绿）
- `pnpm typecheck` ✓
- `pnpm lint`：20 warnings / **0 errors**（全为预存）
- `pnpm build` ✓（`NostalgistAdapter` 仍为独立 chunk，未进首屏）
- `pnpm verify:dist`：**全部检查通过**，首屏 JS 112.9 KB gzip（预算 220 KB）

## 注意
- 移除内核不只是删目录：任何「仅该核使用」的支撑模块会成为孤儿并影响构建产物/守卫，删除后务必全量重跑 `build` + `verify:dist` 并扫一遍孤儿引用。
- 内存日志（`.workbuddy/memory/`）已记录本次改动，但按项目约定被 `.gitignore` 排除，不进公开仓库。
- 尚未推送到 GitHub（本地领先 origin 2 个提交）。如需推送请告知。
