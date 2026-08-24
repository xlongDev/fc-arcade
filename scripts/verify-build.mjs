/**
 * 构建产物体检。在 `vite build` 之后运行。
 *
 * 存在的意义：有几类问题 `tsc` 和 `oxlint` 一个都抓不到，dev 模式下也完全正常，
 * 只有生产构建的产物里才看得出来。这类「本地全绿、上线就炸」的回归最难查，
 * 所以把它们变成构建流水线上的硬性检查。
 *
 * 用法：pnpm verify:dist
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')

/** 首屏 JS 的 gzip 预算。超了不算失败，但要显眼地提示。
 *  2026-08-24 起从 220 提到 230：RootLayout 的 LazyMotion 由 domAnimation 换为 domMax
 *  （开启 layout 投影，Segmented / 主题选择器的 layoutId 滑块才会滑动），首屏增约 13.6KB gzip。 */
const ENTRY_GZIP_BUDGET_KB = 230

const failures = []
const warnings = []

function fail(title, detail) {
  failures.push({ title, detail })
}

function warn(title, detail) {
  warnings.push({ title, detail })
}

/** 递归收集 dist 下所有文件 */
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

// ---------------------------------------------------------------- 前置检查

if (!existsSync(DIST)) {
  console.error('✗ dist/ 不存在。请先运行 pnpm build。')
  process.exit(1)
}

const files = walk(DIST)
const jsFiles = files.filter((f) => extname(f) === '.js')
const cssFiles = files.filter((f) => extname(f) === '.css')

if (!existsSync(join(DIST, 'index.html'))) {
  fail('缺少 dist/index.html', '构建产物不完整')
}

// ------------------------------------------- 检查 1：AudioWorklet 未被内联
//
// 历史：项目曾用自研 AudioWorklet（nes-audio-processor）做 NES 采样输出，
// 当时必须保证它作为独立文件产出、不能被 Vite 内联成 data: URI
// （audioWorklet.addModule() 加载 data URI 在部分浏览器会抛
// AbortError: Unable to load a worklet's module，vitejs/vite#6979）。
//
// 现状：移除 jsnes 内核后，唯一的实机内核是 fceumm（nostalgist / RetroArch），
// 音频由 RetroArch 自己的 AudioContext 原生处理，项目不再拥有自定义 AudioWorklet，
// 故该检查已无对象。保留空检查位以标记此处历史约束，避免日后误加 worklet
// 时忘记守卫（届时需在 vite.config 的 assetsInlineLimit 里为新 worklet
// 放行，并恢复本检查）。

const workletAsset = files.find((f) => /audio-processor.*\.js$/.test(f))
if (workletAsset) {
  const src = readFileSync(workletAsset, 'utf8')
  if (!src.includes('registerProcessor')) {
    fail(
      'AudioWorklet 产物内容异常',
      `${relative(ROOT, workletAsset)} 里找不到 registerProcessor 调用，文件可能被打包器改写过。`,
    )
  }
}

// ------------------------------------------------- 检查 2：字体确实被产出
// 像素字体是整站视觉的地基，漏拷会直接回退到系统字体且没有任何报错。

const fontFiles = files.filter((f) => /\.(woff2?|ttf|otf)$/.test(f))
if (fontFiles.length === 0) {
  fail('产物中没有任何字体文件', '像素字体缺失会静默回退到系统字体')
}

// --------------------------------------------- 检查 3：首屏体积没有失控
//
// 根因（2026-08-24 修正）：旧逻辑取「dist 里最大的单个 JS 文件」当首屏，
// 但首屏实际下载量 = HTML module 脚本 + 它**静态 import** 的全部 chunk
// （含共享 chunk，如 motion 的 format-*.js）。最大单文件只数到 entry，
// 把被它 import 的共享 chunk 漏掉了，导致预算守卫对真实下载量失明
// （实测 entry gzip 122KB + format chunk 99.85KB ≈ 226KB，已超 220KB 预算，
// 旧脚本却只数到 122KB 并报告「通过」）。
// 修正：从 index.html 的 module 脚本出发，跟随静态 import 走完整引用图，
// 累加这些 chunk 的 gzip 才是真实首屏体积。

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const entrySrc = (html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/) || [])[1]

/** 把 /assets/foo.js 或 /fc-arcade/assets/foo.js 形式的 URL 解析成 dist 下的绝对路径 */
function resolveAsset(urlPath) {
  const rel = urlPath.replace(/^\//, '')
  let abs = join(DIST, rel)
  if (!existsSync(abs)) {
    // 兼容带 base 前缀的构建产物（如 pnpm build --base /fc-arcade 时，
    // HTML 里是 /fc-arcade/assets/x.js，需剥掉 base 段映射到 dist/assets/x.js）。
    const idx = rel.indexOf('/')
    if (idx > 0) abs = join(DIST, rel.slice(idx + 1))
  }
  return existsSync(abs) ? abs : null
}

/** 匹配静态与动态 import 指向的相对路径（Vite 产物里多为 ./x.js 或 ../x.js） */
const IMPORT_RE = /(?:from|import)\s*["'](\.[^"']+\.js)["']/g

/** 从某个 chunk 出发，收集它静态 import 到的同目录 chunk（不含动态 import） */
function staticImportsOf(file) {
  const src = readFileSync(file, 'utf8')
  const dir = file.substring(0, file.lastIndexOf('/'))
  const out = []
  let m
  while ((m = IMPORT_RE.exec(src))) {
    // 动态 import() 在 Vite 产物里通常是 import("./x.js")，
    // 但上面正则也会抓到。首屏只算静态依赖，故排除明显的 import( 调用。
    if (src.slice(Math.max(0, m.index - 7), m.index).includes('import(')) continue
    const abs = join(dir, m[1])
    if (existsSync(abs)) out.push(abs)
  }
  return out
}

/**
 * 首屏 chunk 集合：从 HTML entry 出发，BFS 遍历静态 import 图。
 * 只走静态依赖（首屏必须下载的），动态 import 的 chunk 运行时才拉，不计入。
 */
function firstScreenChunks(entryFile) {
  const seen = new Set()
  const queue = [entryFile]
  while (queue.length) {
    const f = queue.shift()
    if (seen.has(f)) continue
    seen.add(f)
    for (const dep of staticImportsOf(f)) if (!seen.has(dep)) queue.push(dep)
  }
  return [...seen]
}

let entryChunks = []
let entryGzip = 0
if (entrySrc) {
  const entryFile = resolveAsset(entrySrc)
  if (entryFile) {
    entryChunks = firstScreenChunks(entryFile)
    entryGzip = entryChunks.reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0)
  }
}

if (entryChunks.length === 0) {
  fail('无法确定首屏入口', 'index.html 缺少 type="module" 脚本或 dist 产物不完整')
} else if (entryGzip / 1024 > ENTRY_GZIP_BUDGET_KB) {
  warn(
    '首屏 JS 超出体积预算',
    `首屏 ${entryChunks.length} 个 chunk 合计 gzip ${kb(entryGzip)}，` +
      `预算 ${ENTRY_GZIP_BUDGET_KB} KB。检查是否有本应懒加载的模块被打进了首屏。`,
  )
}

// -------------------------------- 检查 4：可选内核没有被打进首屏
// nostalgist 是可选内核（libretro WASM），必须走动态 import，
// 一旦被静态引用就会把整个 WASM 加载器拖进首屏包。
// 扫描整张首屏引用图（而非单个文件），用运行时专属 token `libretro` 判定，
// 避免误伤 NostalgistAdapter 里的 `RetroArch` 报错文案
// （那条 wrapper 文本会被打进首屏共享 chunk）。

const nostalgistInEntry = entryChunks.some((f) => readFileSync(f, 'utf8').includes('libretro'))
if (nostalgistInEntry) {
  warn(
    'nostalgist 可能被打进了首屏包',
    '它应当只在用户切换到该内核时通过动态 import 加载。',
  )
}

// ------------------------------------------------------------------ 汇总

const totalJs = jsFiles.reduce((n, f) => n + statSync(f).size, 0)
const totalCss = cssFiles.reduce((n, f) => n + statSync(f).size, 0)

console.log('构建产物体检')
console.log('─'.repeat(52))
console.log(`  文件总数    ${files.length}`)
console.log(`  JS          ${jsFiles.length} 个，共 ${kb(totalJs)}`)
console.log(`  CSS         ${cssFiles.length} 个，共 ${kb(totalCss)}`)
console.log(`  字体        ${fontFiles.length} 个`)
if (entryChunks.length > 0) {
  const entryRaw = entryChunks.reduce((n, f) => n + statSync(f).size, 0)
  console.log(
    `  首屏 JS     ${entryChunks.length} 个 chunk，共 ${kb(entryRaw)}（gzip ${kb(entryGzip)}）`,
  )
}
console.log('─'.repeat(52))

for (const w of warnings) {
  console.log(`\n  ! ${w.title}\n    ${w.detail}`)
}
for (const f of failures) {
  console.log(`\n  ✗ ${f.title}\n    ${f.detail}`)
}

if (failures.length > 0) {
  console.log(`\n${failures.length} 项检查未通过。\n`)
  process.exit(1)
}

console.log(
  warnings.length > 0 ? `\n检查通过，有 ${warnings.length} 项提示。\n` : '\n全部检查通过。\n',
)
