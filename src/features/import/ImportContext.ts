import { createContext, useContext } from 'react'

export interface ImportContextValue {
  isOpen: boolean
  /** 打开导入向导；带上 files 则直接跳过选择步骤开始解析 */
  open: (files?: File[]) => void
  close: () => void
}

export const ImportContext = createContext<ImportContextValue | null>(null)

export function useImport(): ImportContextValue {
  const value = useContext(ImportContext)
  if (!value) throw new Error('useImport 必须在 ImportProvider 内部使用')
  return value
}
