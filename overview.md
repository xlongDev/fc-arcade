# 当前本地改动概览（未提交）

按你要求，本次所有改动均保留在 working tree，等待你确认后再 `commit + push`。

## 1. 游戏页底部控制栏按钮顺序

将「键位设置」按钮从音量右侧移到音量左侧。

- 调整前：暂停/继续 → 重置 → 存档 → 截图 → **音量 → 键位设置** → 虚拟手柄
- 调整后：暂停/继续 → 重置 → 存档 → 截图 → **键位设置 → 音量** → 虚拟手柄

文件：`src/features/player/components/PlayerControlBar.tsx`

## 2. 封面一致性/主题适配/文字识别性优化

| 问题 | 修复文件 | 说明 |
|------|----------|------|
| 真实截图封面与程序化封面大小不一致 | `src/features/library/components/GameCover.tsx` | 真实截图/自定义封面图片按用户要求**铺满**封面区，不再做卡带贴纸式内缩。 |
| 网格行间距不一致（有真实截图的行往下顶） | `src/features/library/components/GameCover.tsx` + `src/features/library/layoutConfig.ts` + `src/features/library/components/GameCard.tsx` | 真正根因：**真实截图是 1:1 正方形，而封面容器是 4:3。** `img` 用 `size-full` 在父容器高度尚未由 `aspect-ratio` 确定时，`height:100%` 可能失效，导致图片 intrinsic 高度撑高容器，把 4:3 封面撑成接近 1:1，卡片变高后往下顶、吃掉行间距。修复：① `GameCover` 的 `img` 改为 `absolute inset-0`，脱离文档流，让父容器高度严格由 `aspect-[4/3]` 决定；② 保留 `metaHeight:100px` + `h-[100px]`，保证信息区不溢出。 |
| 程序化封面底色不跟随明暗主题 | `src/cover/palette.ts` + `src/cover/GeneratedCover.tsx` | 用 CSS `light-dark()` 让背景、图案、贴纸、文字、扫描线、暗角、贴纸高光/阴影随浅色/深色主题自动切换。浅色模式下背景变为高亮 pastel、文字变深，避免在米色页面上出现深色块。 |
| 同一游戏在「继续游玩」与网格中封面外观不一样 | `src/features/library/components/RecentRow.tsx` | 移除 `showTitle={false}`，让「继续游玩」的程序化封面也显示标题缩写，与网格卡片一致。 |
| 程序化封面文字只取前两字，识别性弱 | `src/cover/hash.ts` | `coverInitials` 中文提取时跳过常见虚词/助词（之、的、了、和、与…），「火之鸟」→「火鸟」而非「火之」。 |

## 3. 游戏库一键全选

| 改动 | 文件 | 说明 |
|------|------|------|
| 新增像素风图标 | `src/components/icons/index.tsx` | `IconSelect`（单选框+勾）表示进入选择模式；`IconSelectAll`（双选框+勾）表示全选。 |
| 工具栏按钮图标重设计 | `src/features/library/components/LibraryToolbar.tsx` | 进入多选模式改用 `IconSelect`，全选按钮改用 `IconSelectAll`，避免两个按钮都用勾图标造成混淆。 |
| LibraryPage 传 games 给工具栏 | `src/features/library/LibraryPage.tsx` | 让工具栏拿到过滤后的 `games`，从而只选中当前视图里的游戏。 |

行为：
- 未进入多选模式时，全选按钮禁用。
- 点击后选中当前过滤结果里的全部游戏。
- 若当前视图中的游戏已全被选中，按钮标签变为「取消全选」，点击后清空选择。

## 4. 设置页增加清空存档 / ROM / 游戏记录 / 全部数据

| 改动 | 文件 | 说明 |
|------|------|------|
| DAO 层新增 `clear()` | `src/data/dao.ts` + `src/types/storage.ts` | `romDao.clear()` / `saveStateDao.clear()` / `gameDao.clear()` / `coverDao.clear()` / `sessionDao.clear()` / `crcLearnDao.clear()`。 |
| 数据清理 UI | `src/features/settings/SettingsPage.tsx` | 在「数据」Tab 下新增 4 个危险按钮：清空存档、清空 ROM、清空游戏记录与封面、清空全部数据，均带二次确认弹窗。 |

行为：
- **清空所有存档**：删除全部即时存档、自动存档与存档缩略图。
- **清空所有 ROM**：删除全部 ROM 二进制文件，保留游戏库记录、封面与存档。
- **清空游戏记录与封面**：删除游戏库条目、自定义/截图封面、游玩记录与 CRC 学习记录；不删 ROM 与存档。
- **清空全部数据**：调用 `clearAllData()` 删除游戏、ROM、封面、存档、会话等所有本地业务数据。
- 所有操作完成后都会通过 `toast` 提示，并广播相应事件让界面刷新。

## 5. 大卡片滚动性能优化

用户反馈 392 个游戏在大卡片模式下滚动不够流畅。核心根因是虚拟滚动虽然只挂载视口附近节点，但每张卡片仍是 `motion` 组件，并且叠加了 `useTilt` spring、`CardOverlay` / `FavoriteButton` / `SelectMark` 的 `backdrop-blur`，滚动时大量节点同时创建/销毁开销很大。

| 改动 | 文件 | 说明 |
|------|------|------|
| 虚拟化时卡片降级为普通 DOM | `src/features/library/components/GameCard.tsx` / `CompactCard.tsx` / `GameRow.tsx` / `ShelfCard.tsx` | `animate=false`（启用虚拟滚动）时改用原生 `article`/`div`，不再使用 `motion.*` 组件。 |
| 禁用 tilt 与 hover 动效 | `src/features/library/components/useTilt.ts` + 上述卡片文件 | `useTilt` 在禁用时返回普通占位值、不创建 spring；虚拟化分支不传递 `whileHover` 和 3D tilt。 |
| 降低合成层开销 | `src/features/library/components/CardOverlay.tsx` / `FavoriteButton.tsx` / `SelectMark.tsx` | 移除 `backdrop-blur`，改用半透明实色背景，减少滚动时的合成层压力。 |
| 渲染隔离 | `src/features/library/views/GridView.tsx` / `ListView.tsx` / `ShelfView.tsx` | 虚拟滚动行/项容器增加 `contain-[layout_paint]`。 |
| 图片加载优先级 | `src/features/library/components/GameCover.tsx` | 真实截图/自定义封面增加 `fetchPriority="low"`，避免列表滚动时图片解码抢占主线程。 |

## 6. 主题切换动画：已恢复原实现

用户要求完全恢复到「上两轮前（未要求更改主题动画时）」的代码。两轮的优化均已 `git restore` 回退至 HEAD，即原始的 View Transitions API 首选 + `.theme-transition` 300ms fallback（REVEAL_MS=560）实现。当前主题切换代码与项目最初一致，无主题动画相关未提交改动。

## 验证

- `pnpm typecheck` ✓
- `pnpm lint` ✓（0 error，20 warning 均为预存，与本批改动无关）
- `pnpm build` ✓（首屏 JS gzip 116.7KB，预算 220KB 内）
- `pnpm verify:dist` ✓

## 状态

未提交。等你确认后统一 `commit + push`。
