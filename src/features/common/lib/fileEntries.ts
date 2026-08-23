/**
 * 拖拽文件夹的递归读取。
 *
 * DataTransfer.files 只能拿到顶层文件，拖进来的目录会丢。必须走
 * webkitGetAsEntry() 拿 FileSystemEntry 再手动递归；readEntries 每次
 * 最多返回一批（Chrome 是 100 条），必须循环读到返回空数组为止。
 */

/** 单次拖拽最多收集的文件数，防止误拖巨型目录把页面拖死 */
const MAX_FILES = 4000
/** 目录递归深度上限 */
const MAX_DEPTH = 8

function readEntryFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null),
    )
  })
}

function readDirBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    reader.readEntries(
      (entries) => resolve(entries),
      () => resolve([]),
    )
  })
}

async function readDirEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader()
  const all: FileSystemEntry[] = []
  // readEntries 分批返回，空数组代表读完；递归读取目录必须串行逐批取。
  /* eslint-disable eslint/no-await-in-loop */
  for (;;) {
    const batch = await readDirBatch(reader)
    if (batch.length === 0) break
    all.push(...batch)
    if (all.length >= MAX_FILES) break
  }
  /* eslint-enable eslint/no-await-in-loop */
  return all
}

async function walkEntry(entry: FileSystemEntry, depth: number, out: File[]): Promise<void> {
  if (out.length >= MAX_FILES) return

  // 文件系统递归遍历天然串行：读文件与递归子目录都必须逐个 await。
  /* eslint-disable eslint/no-await-in-loop */
  if (entry.isFile) {
    const file = await readEntryFile(entry as FileSystemFileEntry)
    if (file) out.push(file)
    return
  }

  if (entry.isDirectory && depth < MAX_DEPTH) {
    const children = await readDirEntries(entry as FileSystemDirectoryEntry)
    for (const child of children) {
      await walkEntry(child, depth + 1, out)
      if (out.length >= MAX_FILES) return
    }
  }
  /* eslint-enable eslint/no-await-in-loop */
}

/**
 * 从一次拖放事件里收集所有文件，含目录内的。
 * 浏览器不支持 webkitGetAsEntry 时退回 DataTransfer.files。
 */
export async function collectFilesFromDataTransfer(transfer: DataTransfer): Promise<File[]> {
  const items = Array.from(transfer.items ?? [])
  const entries: FileSystemEntry[] = []

  for (const item of items) {
    if (item.kind !== 'file') continue
    const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
    if (entry) entries.push(entry)
  }

  if (entries.length === 0) {
    return Array.from(transfer.files ?? [])
  }

  const out: File[] = []
  // 逐个目录递归收集，不能并行（递归且共享 out 上限）。
  /* eslint-disable eslint/no-await-in-loop */
  for (const entry of entries) {
    await walkEntry(entry, 0, out)
  }
  /* eslint-enable eslint/no-await-in-loop */
  return out
}

/** 拖入的内容里是否含文件（排除纯文本拖拽） */
export function dataTransferHasFiles(transfer: DataTransfer | null): boolean {
  if (!transfer) return false
  return Array.from(transfer.types ?? []).includes('Files')
}
