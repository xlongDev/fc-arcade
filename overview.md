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
## 2026-08-12 追加修复：移除 fceumm 游戏画面左右红线

### 现象
切到 fceumm 后，游戏画面左右两侧出现竖向红线（用户截图《森林王子》两侧边缘泛红）。

### 根因
NES 有过扫描区（左右各 8px），很多游戏把背景色泄到这里；fceumm/RetroArch 默认输出完整 256×240，过扫描边会露出来，而 jsnes 时代只画了可视区。

### 第一版（`fe165b0`，已弃用）
在 `retroarchConfig` 加 `video_crop_overscan: true`，但经 nostalgist 传入后**不生效**，红线依旧。说明不要假设 retroarchConfig 的每个键都会生效。

### 最终修复（渲染层 + 截图层硬裁）
- `src/types/emulator.ts`：`NES_OVERSCAN_X=8` / `NES_VISIBLE_WIDTH=240` / `NES_VISIBLE_HEIGHT=240`。
- `EmulatorScreen.tsx`：`fitSize` 改用 `NES_VISIBLE_*`；canvas CSS 宽度放大为 `size.width*(NES_WIDTH/NES_VISIBLE_WIDTH)`，父容器 `overflow-hidden` 居中 → 两侧过扫描被裁，显示 240×240 有效区。
- `src/emulator/shared/canvas.ts`：`rescaleBlob` 增加可选 `crop`，先裁再放大。
- `NostalgistAdapter.screenshot`：传 `crop:{x:8,y:0,w:240,h:240}`，截图同样去掉红线。
- `PlayerPage` / `usePlaytimeTracker`：封面尺寸改用 `NES_VISIBLE_WIDTH/HEIGHT*scale`（封面不再带红线，尺寸 512→480）。

### 质量门（全绿）
typecheck ✓ / lint 20 warnings 0 errors ✓ / build ✓ / verify:dist 全部检查通过 ✓

## 注意
- 移除内核不只是删目录：任何「仅该核使用」的支撑模块会成为孤儿并影响构建产物/守卫，删除后务必全量重跑 `build` + `verify:dist` 并扫一遍孤儿引用。
- 内存日志（`.workbuddy/memory/`）已记录本次改动，但按项目约定被 `.gitignore` 排除，不进公开仓库。
- 已全部推送到 GitHub（origin/main 已更新至 `fa87973`）。

## 2026-08-12 UI/UX 改进：播放器界面改造

- **移除切换内核 UI**：`PlayerTopBar` 删除切换内核按钮，`useEmulatorSession` 删除 `switchCore`。
- **游戏区域圆角**：`EmulatorScreen` 非全屏时加 `rounded-2xl` 和细白边阴影；全屏时自动 `rounded-none` 以真正铺满。
- **控制栏/光标自动隐藏**：`useAutoHideControls` idle 时间统一为 2s；新增 `useHideCursor`，游戏运行中控制栏隐藏且鼠标静止 2s 后隐藏光标。
- **游戏内改键位**：提取可复用 `KeyboardMappingPanel`，底部控制栏增加「键位设置」按钮，游戏内 Sheet 改键即时同步给 `InputManager`。

### 质量门（全绿）
typecheck ✓ / lint 20 warnings 0 errors ✓ / build ✓ / verify:dist 全部检查通过 ✓（首屏 JS 116.2 KB gzip）
