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

/** 首屏 JS 的 gzip 预算。超了不算失败，但要显眼地提示。 */
const ENTRY_GZIP_BUDGET_KB = 220

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
// Vite 默认会把小于 assetsInlineLimit(4096B) 的资源转成 data: URI。
// AudioWorklet 的 addModule() 加载 data URI 在部分浏览器会抛
// AbortError: Unable to load a worklet's module（vitejs/vite#6979）。
// dev 模式走真实 URL，所以这个问题只在生产构建里存在。

const inlinedScript = jsFiles.filter((f) =>
  readFileSync(f, 'utf8').includes('data:text/javascript;base64'),
)

if (inlinedScript.length > 0) {
  fail(
    'AudioWorklet 被内联成了 data: URI',
    `以下产物内含 base64 脚本，线上音频会加载失败：\n` +
      inlinedScript.map((f) => `      ${relative(ROOT, f)}`).join('\n') +
      `\n    修法：worklet 导入处加 ?url&no-inline 后缀。`,
  )
}

const workletAsset = files.find((f) => /audio-processor.*\.js$/.test(f))
if (!workletAsset) {
  fail(
    '找不到独立的 AudioWorklet 产物',
    'dist/ 下应存在 audio-processor-*.js。它必须是独立文件，不能被打进主包。',
  )
} else {
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

const entryJs = jsFiles
  .map((f) => ({ file: f, size: statSync(f).size }))
  .toSorted((a, b) => b.size - a.size)[0]

let entryGzip = 0
if (entryJs) {
  entryGzip = gzipSync(readFileSync(entryJs.file)).length
  if (entryGzip / 1024 > ENTRY_GZIP_BUDGET_KB) {
    warn(
      '首屏 JS 超出体积预算',
      `${relative(ROOT, entryJs.file)} gzip 后 ${kb(entryGzip)}，` +
        `预算 ${ENTRY_GZIP_BUDGET_KB} KB。检查是否有本应懒加载的模块被打进了首屏。`,
    )
  }
}

// -------------------------------- 检查 4：可选内核没有被打进首屏
// nostalgist 是可选内核（libretro WASM），必须走动态 import，
// 一旦被静态引用就会把整个 WASM 加载器拖进首屏包。
// 用运行时专属 token `libretro` 判定，避免误伤 NostalgistAdapter 里
// 的 `RetroArch` 报错文案（那条 wrapper 文本会被打进首屏共享 chunk）。

const nostalgistInEntry = entryJs
  ? readFileSync(entryJs.file, 'utf8').includes('libretro')
  : false
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
if (entryJs) {
  console.log(`  首屏 JS     ${kb(entryJs.size)}（gzip ${kb(entryGzip)}）`)
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
