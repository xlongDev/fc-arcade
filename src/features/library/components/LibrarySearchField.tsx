import { useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui'
import { IconSearch } from '@/components/icons'
import { useDebouncedValue } from '@/features/common/hooks/useDebouncedValue'
import { useLibraryStore } from '@/store'
import { cn } from '@/lib/cn'

interface Props {
  className?: string
  placeholder?: string
}

/**
 * 搜索框。导航栏和移动端工具栏各挂一个实例，
 * 通过 store 里的 filter.keyword 保持同步，输入 300ms 防抖后才落库。
 */
export function LibrarySearchField({ className, placeholder = '搜索游戏…' }: Props) {
  const keyword = useLibraryStore((s) => s.filter.keyword)
  const setFilter = useLibraryStore((s) => s.setFilter)

  const [local, setLocal] = useState(keyword)
  const debounced = useDebouncedValue(local, 300)
  const lastSynced = useRef(keyword)

  useEffect(() => {
    if (debounced === lastSynced.current) return
    lastSynced.current = debounced
    setFilter({ keyword: debounced })
  }, [debounced, setFilter])

  // 外部（清空筛选、点击标签）改动 keyword 时把输入框拉回来
  useEffect(() => {
    if (keyword === lastSynced.current) return
    lastSynced.current = keyword
    setLocal(keyword)
  }, [keyword])

  return (
    <div id="library-search-field" className={cn('min-w-0', className)}>
      <Input
        value={local}
        onChange={setLocal}
        placeholder={placeholder}
        icon={<IconSearch size={16} />}
        clearable
      />
    </div>
  )
}
