# FC Arcade · NES 红白机在线合集

一个纯前端、可离线运行的 FC（NES）红白机游戏合集站点。游戏 ROM **不内置** —— 全部由用户自己上传，站点负责「识别 → 整理 → 在浏览器里实机模拟运行」这一整条体验链路。

视觉风格是 **像素风 + 液态玻璃质感 + 超大圆角 + 丰富过渡动画**：用像素字体（Press Start 2P / Silkscreen）、玻璃拟态面板、扫描线/噪点叠加，配 32 套可一键切换的主题（切换时整页有过渡动画，封面墙会跟着变调）。

> ⚠️ **法律声明**：本项目不提供任何受版权保护的游戏 ROM。请仅上传你合法拥有的备份。ROM 数据只存在你本地浏览器（IndexedDB），不会上传到任何服务器。

---

## 特性

- **浏览器端模拟器**：基于 [nostalgist](https://github.com/derekhe/nostalgist) 封装的 **fceumm（RetroArch WASM）内核**，支持音频（AudioWorklet，零延迟采样）、画面整数缩放、扫描线滤镜、FPS 显示。核心文件 **已本地化到 `public/cores/`，完全离线可用**，是项目唯一的实机内核。
- **ROM 自上传 + 自动识别**：上传 `.nes` / `.fds` / `.unf` 文件或 zip 合集，自动解析 iNES 头、计算 CRC32，按「CRC 精确命中 → 自学习库 → 文件名模糊匹配 → 兜底」四级信号推断游戏身份，并给出置信度。
- **CRC 自学习闭环**：某次你手动改对了标题，下次同一个 ROM 直接精确命中你改过的名字。
- **封面三层递进**：用户上传封面 → 运行时自动截图 → 程序化生成的液态玻璃封面兜底（同一游戏永远同一张图，确定性生成）。
- **统一输入系统**：键盘 + Gamepad API + 触摸虚拟手柄三源汇聚，按位或合并；支持改键、连发、手柄震动、摇杆死区。
- **完整播放控制**：暂停 / 重置 / 全屏 / 音量 / 静音 / 即时存档与读档（多槽位）。
- **游戏库**：卡片 / 紧凑网格 / 列表 / 封面墙 / 卡带架 五种布局；搜索（含中文拼音首字母）、筛选（分类 / 年代 / 收藏）、多布局切换、最近游玩、收藏、批量操作、虚拟滚动。
- **32 套主题 + 液态玻璃**：运行时切换 CSS 变量，带过渡动画；偏好持久化到 localStorage。
- **响应式**：桌面双栏导航 + 移动端底部 Tab 栏；虚拟手柄在触屏设备自动可用。

---

## 技术栈

| 关注点 | 选型                                                                 |
| --- | ------------------------------------------------------------------ |
| 框架  | React 19.2 + TypeScript 7.0（`strict` + `noUncheckedIndexedAccess`） |
| 构建  | Vite 8.2（`@vitejs/plugin-react`、`@tailwindcss/vite`）               |
| 样式  | Tailwind CSS 4.3（设计令牌走 CSS 变量，32 套主题运行时覆写）                         |
| 动画  | Motion 13（`motion/react`）                                          |
| 状态  | Zustand 5（`persist` 走 localStorage）                                |
| 存储  | Dexie 4（IndexedDB：游戏、ROM 二进制、封面、存档、会话、CRC 自学习库）                    |
| 模拟器 | fceumm 内核（nostalgist 0.21 封装的 RetroArch WASM，默认且唯一，懒加载） |
| 大列表 | `@tanstack/react-virtual`                                          |
| 压缩  | fflate 0.8（zip 合集解包）                                               |
| 校验  | oxlint 1.78（`tsc` 仅做类型检查，lint 用 oxlint）                            |

---

## 目录结构

```
src/
├── app/              # 应用根、路由表、根布局、导航栏、导入 Provider 挂载点
├── components/
│   ├── ui/           # 通用 UI 组件库（Button/Dialog/Slider/Toast/Skeleton…）
│   └── icons/        # 统一 SVG 图标集（像素硬边风）
├── config/           # 站点级常量
├── cover/            # 程序化封面（确定性生成 + 三层回退 hook）
├── data/             # 持久化层（Dexie DAO + 查询/过滤/排序）
├── emulator/         # 模拟器抽象层
│   ├── nostalgist/   # fceumm 适配器（nostalgist 封装，懒加载）
│   └── shared/       # ROM 解析、存档、canvas 工具
├── features/         # 按业务域切分
│   ├── common/       # 跨域通用组件/hook/lib
│   ├── game-detail/  # 游戏详情/编辑弹窗（含重新识别）
│   ├── import/       # ROM 导入向导 + 识别管线对接
│   ├── library/      # 游戏库首页（5 种布局 + 筛选/搜索/选择）
│   ├── player/       # 播放器页（模拟器宿主）
│   └── settings/     # 设置页（主题/音频/画面/控制/改键）
├── input/            # 三源输入系统（键盘/手柄/触摸）+ InputManager
├── lib/              # 小工具（cn/emitter/format/id）
├── metadata/         # ROM 识别与匹配（crc32/ines/文件名解析/匹配器/导入管线）
├── store/            # Zustand slices（settings/library/games）
├── styles/           # 全局样式与设计令牌
├── theme/            # 主题系统（32 套主题 + 运行时切换 + 过渡）
└── types/            # 全项目类型契约（只读，跨模块共享）
```

**路由表**（`src/app/routes.tsx`，使用 HashRouter，故可托管在任意子路径下）：

| 路径              | 页面    | 加载方式 |
| --------------- | ----- | ---- |
| `/`             | 游戏库首页 | 首屏   |
| `/play/:gameId` | 播放器   | 懒加载  |
| `/settings`     | 设置    | 懒加载  |
| `*`             | 404   | 首屏   |

---

## 快速开始

```bash
# 安装依赖（项目使用 pnpm）
pnpm install

# 本地开发（默认 http://localhost:5173，host 已开，可局域网访问）
pnpm dev

# 类型检查 + 代码质量（CI 在 PR / main 上自动跑这一组）
pnpm typecheck   # tsc --noEmit
pnpm lint        # oxlint src scripts
pnpm test        # vitest run
pnpm check       # typecheck && lint && test

# 生产构建（GitHub Pages 子路径部署，务必带 base）
pnpm build -- --base /fc-arcade/

# 构建产物体检（必跑：首屏体积预算、字体存在、fceumm 内核未被静态打进首屏等）
pnpm verify:dist

# 本地预览生产构建
pnpm preview
```

> Node 版本：构建脚本依赖 Node 20+（Vite 8 要求）。键位映射用 `event.code`，输入法/非 QWERTY 布局无碍。
> 本地 dev（`pnpm dev`）不需带 base；只有构建产物要托管在 `https://xlongdev.github.io/fc-arcade/` 时才需要 `--base /fc-arcade/`（CI 已内置）。

---

## 核心机制

### 模拟器抽象（`src/emulator`）

统一 `EmulatorAdapter` 接口，对上层屏蔽内核差异。项目当前唯一的实机内核是 `NostalgistAdapter`（fceumm / nostalgist 封装），通过 `await import()` 懒加载，不会进入首屏包。`createEmulator(core)` 工厂按设置里的 `defaultCore` 选择（目前仅 `nostalgist` 一项）。

音画同步采用**音频水位反压时钟**：帧数由 `AudioContext` 当前缓冲水位决定（追帧/丢帧），避免音画漂移。连发（turbo）做在输入层（相位脉冲），与内核无关。

### 主题系统（`src/theme`）

主题是一组 CSS 变量集合（颜色/圆角/阴影/缓动）。`ThemeProvider` 在应用根部注入，切换时先写 `data-theme`，再用 **`@property` 轻量过渡**（着色器级 CSS 变量动画，无快照抖动）平滑切换；不支持 `@property` 的浏览器直接切换。偏好存 localStorage，键 `fc-arcade-settings`，`index.html` 内有防闪白内联脚本在首屏绘制前就把主题套上。

> 组件里**禁止写死十六进制颜色**——一律用设计令牌（`bg-glass` / `text-accent` 等），否则换主题时颜色会卡住。

### 封面三层递进（`src/cover`）

1. 用户上传封面 2. 运行时自动截图 3. 程序化生成（FNV-1a 哈希 → mulberry32 RNG 派生图案与配色，确定性、与当前主题强调色混合）。`useGameCover` 按优先级回退，用引用计数 LRU 管理 `URL.createObjectURL`，长列表滚动不漏内存。

### 输入系统（`src/input`）

`InputManager` 维护 P1/P2 两套按键位，三源各自 `poll()` 后**逐玩家按位或**合并（任一来源按下即按下，无需「当前活动设备」状态机）。失焦统一清空（解决「切走再切回来角色卡住」）。PlayerIndex(0/1) → RetroArch 端口(1/2) 的 +1 映射全项目只存在 `NostalgistAdapter.ts` 一处常量。

### ROM 识别与自学习（`src/metadata`）

`importFiles()` → 读取字节 → fflate 解 zip 抽 ROM → 解析 iNES → 算 CRC（去头/整文件都算）→ `matchRom()` 多信号融合 → 产出候选项。`commitImport()` 写入 Dexie 事务（原子）。用户改过的标题写入 `crcLearnDao`，形成自学习闭环。

---

## 数据存储

所有数据存浏览器 **IndexedDB**（Dexie）：

- `games`：游戏元数据（detected / overrides / 派生字段）
- `roms`：ROM 二进制（用户上传，不上传任何服务器）
- `covers`：用户上传 / 运行时截图的封面 Blob
- `saveStates`：即时存档
- `sessions`：最近游玩、游玩时长
- `crcLearn`：CRC → 标题 自学习映射

清除浏览器站点数据即清空全部内容。

### 数据备份与迁移

所有数据默认只在本机 IndexedDB，换设备或清缓存会丢失。设置页「数据」分区提供完整备份：

- **导出备份**：把 `games` / `roms`（ROM 二进制）/ `covers` / `saveStates`（存档与缩略图）/ `sessions` / `crcLearn` 六张表 + 设置（localStorage）打包成一个 `.fcab` 文件（本质是 zip，可改名 `.zip` 打开）。导出过程按表读数据、逐个 Blob 转 ArrayBuffer 写入 zip，带进度回调与 `AbortSignal` 支持。
- **恢复备份**：选 `.fcab` / `.zip` 文件后，按清单（manifest）校验格式与版本，再写入数据库。两种模式：
  - **合并（默认）**：按游戏 id 合并，不会删除备份中没有的已有游戏。
  - **清空后恢复**：先清空本机全部数据，再写入备份（不可撤销，确认弹窗会提醒）。
- 写入在单笔 Dexie 事务内原子完成（要么全进、要么全不进）；游戏元数据导入时重算 `titleNorm` / `searchText` 派生字段，保证与当前代码一致。
- 文件用 fflate 打包，**仅导出 / 导入时才动态加载**（不进首屏）。

> 备份文件不包含任何服务端交互，纯本地产物；建议重大改动前后各留一份。

---

## 性能与首屏

- 首屏只加载游戏库所需代码；**播放器、设置页、游戏详情弹窗、导入向导全部懒加载**。
- 模拟器内核（fceumm）、识别管线、fflate 均不进首屏。
- 首屏 JS 预算 220 KB gzip（`scripts/verify-build.mjs` 守卫）。当前实测首屏 entry chunk ≈ 117 KB gzip，Motion 共享 chunk ≈ 95 KB gzip，浏览器首屏下载合计 ≈ 212 KB gzip，在预算内。
- 音频由 fceumm（nostalgist / RetroArch）原生处理，项目不再包含自定义 AudioWorklet；移除 jsnes 内核时一并删除了 `src/emulator/audio/` 下的自研 worklet 及其 `vite.config` 内联兜底。

---

## 开发规范

- `src/types/**` 是全项目契约，**只读不改**；跨模块接口先对齐类型再写实现。
- 新增 UI 走 `src/components/ui`，图标走 `src/components/icons`，保持像素硬边风（stroke `square`/`miter`）。
- 改主题相关视觉一律用令牌，不写死颜色。
- 提交前跑 `pnpm check && pnpm build -- --base /fc-arcade/ && pnpm verify:dist`。

详见 [DEPLOY.md](./DEPLOY.md) 了解部署与构建守卫细节。

---

## 持续集成与部署

- **质量门禁（CI）**：`.github/workflows/ci.yml` 在 `push` 到 `main` 与 `pull_request` 时运行 `pnpm typecheck` → `pnpm lint` → `pnpm test`（使用 pnpm 11 + Node 22）。
- **自动部署**：`.github/workflows/deploy-pages.yml` 在 `push` 到 `main` 时构建（`pnpm build --base /fc-arcade/`）并发布到 GitHub Pages，线上地址 **https://xlongdev.github.io/fc-arcade/**。流程含 `verify:dist` 守卫，Pages Source 选「GitHub Actions」。
- 本地复刻线上构建：`pnpm install && pnpm build -- --base /fc-arcade/ && pnpm verify:dist`。
