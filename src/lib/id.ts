/** 生成唯一 id。优先用 crypto.randomUUID，降级到时间戳 + 随机数。 */
export function uid(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${raw}` : raw
}

/**
 * FNV-1a 32 位哈希。用于程序化封面的确定性配色——
 * 同一标题在任何设备上必须产出同一张封面。
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
