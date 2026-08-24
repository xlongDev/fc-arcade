# 部署指南 · FC Arcade

FC Arcade 是**纯静态站点**（SPA），无任何后端、无服务端渲染、无 API 调用。所有游戏数据只存在于访问者本地浏览器。部署就是「把 `pnpm build` 的产物丢到一个静态文件服务器上」。

---

## 1. 构建

```bash
pnpm install        # 用 pnpm（lockfile 为 pnpm-lock.yaml）
pnpm build          # 产物输出到 dist/
pnpm verify:dist    # 必跑：构建产物体检，不通过不要上线
```

`verify:dist` 会检查（任一项失败退出码非 0）：

| 检查 | 说明 |
|------|------|
| fceumm 内核未进首屏 | 唯一内核只走动态 `import()`，不进首屏包 |
| 字体存在 | 产物包含 woff2 字体 |
| 首屏 JS 预算 | 220 KB gzip（超出仅 warning，仍放行） |
| fceumm 内核未进首屏 | 唯一内核只走动态 `import()`，不进首屏包 |

> **务必先 `verify:dist` 再发布**。模拟器音频由 fceumm（RetroArch）原生处理，项目不再依赖自定义 AudioWorklet；构建守卫重点确认首屏体积、字体与内核懒加载边界。

---

## 2. 托管位置（子路径）

站点使用 **HashRouter**（`createHashRouter`），路由走 `#/play/xxx` 这种 hash 形式，**不依赖服务端 URL 重写**，因此可以被放在任意子路径下（如 `https://example.com/fc/`）而无需特殊配置。

- **如果挂在域名根目录**：什么都不用改，`vite build` 默认 `base: '/'` 即可。
- **如果挂在子路径**（如 `/fc/`）：构建时指定 base：
  ```bash
  pnpm build -- --base /fc/
  ```
  或在 `vite.config.ts` 的 `defineConfig` 里设 `base: '/fc/'`。

---

## 3. 静态服务器配置

把 `dist/` 整个目录作为静态根即可。绝大多数平台零配置：

### Vercel / Netlify / Cloudflare Pages / GitHub Pages
- 构建命令：`pnpm build`
- 输出目录：`dist`
- 无需 SPA rewrite（因为用 hash 路由，不存在深链 404）。

### 自托管（Nginx 示例）
```nginx
server {
  listen 80;
  server_name your.domain;
  root /var/www/fc-arcade/dist;
  index index.html;

  # 静态资源走长效缓存（带内容 hash，可放心长缓存）
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # SPA 入口
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Docker（多阶段，可选）
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install && pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# 如需子路径，把上面的 nginx.conf 拷进来并设 base 后重新 build
```

---

## 4. 运行时依赖（浏览器端）

没有服务端依赖，但有浏览器能力要求：

| 能力 | 用途 | 降级 |
|------|------|------|
| ES2022 | 构建 target | 现代浏览器（2022+） |
| AudioContext（RetroArch 内部创建） | NES 音频输出 | 不支持则无音 |
| Gamepad API | 手柄输入 | 无则仅键盘/触摸 |
| IndexedDB | 游戏/ROM/存档存储 | 无则站点不可用 |
| `@property` CSS 变量过渡 | 主题切换过渡动画 | 不支持则直接切换（无动画） |
| pointer events / touch-action | 虚拟手柄 | 触屏设备 |

`vite.config.ts` 中 `build.target: 'es2022'`、`cssTarget: 'chrome111'`。

---

## 5. 性能预算

- **首屏 JS**：预算 220 KB gzip（`verify:dist` 守卫）。
  - 当前实测：首屏 entry chunk ≈ 117 KB gzip + Motion 共享 chunk ≈ 95 KB gzip，浏览器首屏下载合计 ≈ 212 KB gzip（在预算内）。
  - 播放器、设置、游戏详情、导入向导均已懒加载，不计入首屏。
- **懒加载边界**：`PlayerPage`、`SettingsPage`（路由级 lazy）、`ImportWizard`（Provider 内按需挂载）、`GameDetailDialog`（按需挂载）。
- **fceumm 内核**：项目唯一的实机内核，通过 `await import()` 加载（~16 KB gzip），不进首屏。

如需进一步压首屏：把 `RootLayout` 的入场动画改用纯 CSS（去掉首屏对 Motion 的依赖），可把约 95 KB 的 Motion 共享 chunk 移出首屏关键路径。

---

## 6. 环境变量

**当前无任何环境变量 / 构建期配置**。站点完全自包含，不涉及任何密钥或外部服务。不要在部署平台配置多余的环境变量，也不会被读取。

---

## 7. 已知限制

- **不提供任何 ROM**：用户必须自己上传合法拥有的备份。
- **ROM 数据仅存本地（但可备份迁移）**：IndexedDB 跟随浏览器/设备，清站点数据即丢失。已提供「数据备份」功能（设置页「数据」分区）：导出 `.fcab`（本质是 zip）包含六张表 + 设置，恢复支持「合并」与「清空后恢复」两种模式。**换设备请走备份文件，而非依赖浏览器同步。**
- **fceumm 内核已本地化**：fceumm 内核（`fceumm_libretro.js` + `fceumm_libretro.wasm`，由 nostalgist 封装）随仓库放在 `public/cores/`，由 `NostalgistAdapter` 通过 `import.meta.env.BASE_URL + 'cores'` 加载，**离线可用**，不再依赖 CDN。这是项目唯一的实机内核。如需更新内核版本，从 nostalgist 的 `retroarch-emscripten-build@v1.22.2` 重新下载同名文件覆盖即可。
- **自学习库是 per-浏览器**：`crcLearn` 已随备份文件导出/导入，但日常不会跨设备自动同步。

---

## 8. 发布检查清单

- [ ] `pnpm install` 用的是 pnpm
- [ ] `pnpm build` 成功，`dist/` 已生成
- [ ] **`pnpm verify:dist` 退出码为 0**（重点确认首屏体积预算与 fceumm 内核未进首屏）
- [ ] 子路径部署时确认 `base` 已正确设置
- [ ] 静态服务器对 `/assets/*` 设了长效缓存（文件名带 hash）
- [ ] 真机用静态服务器（非 dev）跑一遍：上传一个 ROM → 播放器有画面有声音 → 存档/读档可用
