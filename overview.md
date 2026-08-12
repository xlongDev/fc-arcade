# 修复：截图/上传封面后封面墙不更新

## 现象
游戏内点截图（或自动截图、在详情页上传自定义封面）后，提示"已设为封面"，但库里的封面墙仍显示旧图（或仍是程序化生成图）。

## 根因
封面显示走 `src/cover/coverCache.ts` 的引用计数 + objectURL 缓存：`acquireCover` 命中缓存时**直接返回旧 objectURL**（不重读库）。库里定义了 `invalidateCover(gameId)` 用于在"封面被改写后"作废旧 URL 并通知订阅组件重取——但**它从没在任何写入路径被调用**（grep 全仓只有 `invalidateAllCovers` 内部用到，用于清空/导入备份）。

结果：截图/上传只写进了 IndexedDB，而封面墙缓存仍是旧 URL，所以封面不更新。

`useGameCover` 的刷新机制本身是好的（`version` 由 `subscribeCover`/`getCoverVersion` 驱动，会随 `invalidateCover` 重新取图）——只差写入时触发一次。

## 修复
在全部 3 个封面写入点写完 `coverDao` 后调用 `invalidateCover(gameId)`：
- `src/features/player/PlayerPage.tsx`（手动截图 `captureCover`）
- `src/features/player/usePlaytimeTracker.ts`（自动截图 `captureCover`）
- `src/features/game-detail/components/CoverEditor.tsx`（上传 `applyFile`、重置 `resetCover`）

注意：刻意**不**用 `notifyLibraryChanged()` 触发整库刷新来替代——播放器页直接调它会触发 `useGameById` 重拉 → loading 闪烁 → 播放器被卸载重挂 → 模拟器重启（见上一轮修复）。`invalidateCover` 只动封面缓存，不影响播放器。

## 质量门（全绿）
- `pnpm typecheck` ✓
- `pnpm lint` ✓（0 error，20 warning 均为预存）
- `pnpm build` ✓
- `pnpm verify:dist` ✓（首屏 JS gzip 116.2KB，预算 220KB 内）

## 验证建议
进游戏点截图 → 退出回库，封面应变成刚截的图；详情页上传/重置自定义封面，库与详情页预览应同步更新。
