/**
 * ROM 识别与导入管线的统一出口。
 * 其他模块一律 `import { importFiles } from '@/metadata'`，不要深入 import 子文件。
 *
 * 唯一的例外是 `@/metadata/text`：它是叶子模块，`@/data` 直接 import 它以避免循环依赖。
 */

/* 基础工具 */
export { crc32 } from './crc32'
export { parseRom } from './ines'
export type { ParsedFileName } from './filename'
export { parseFileName } from './filename'
export type { SearchTextInput } from './text'
export { buildSearchText, diceCoefficient, normalizeTitle, restoreLeadingArticle } from './text'
export { hasCjk, pinyinInitials } from './pinyin'

/* 内置标题库 */
export { findTitleById, NES_TITLES } from './nes-titles'

/* 匹配器 */
export type {
  MatchContext,
  MatchInput,
  MatchOutcome,
  MatchSource,
  TitleSuggestion,
} from './matcher'
export {
  createMatchContext,
  CUSTOM_TITLE_PREFIX,
  encodeCustomTitleId,
  matchByFileName,
  matchRom,
  reidentify,
  resolveTitleId,
  titleIdForUserTitle,
} from './matcher'

/* 导入管线 */
export type { ImportOptions, ImportProgressFn } from './importer'
export { clearPendingRoms, commitImport, importFiles } from './importer'
