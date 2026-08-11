/** 可导入的文件扩展名。zip 由识别管线内部解包。 */
export const ROM_EXTENSIONS = ['.nes', '.fds', '.unf', '.unif', '.zip'] as const

export const ROM_ACCEPT = ROM_EXTENSIONS.join(',')

export function isRomFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return ROM_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** 过滤掉 .DS_Store、Thumbs.db 之类的目录噪声后再判扩展名 */
export function filterRomFiles(files: File[]): File[] {
  return files.filter((file) => {
    if (file.name.startsWith('.')) return false
    return isRomFileName(file.name)
  })
}
