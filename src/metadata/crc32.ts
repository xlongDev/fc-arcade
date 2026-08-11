/** 标准 CRC-32（IEEE 802.3，多项式 0xEDB88320），查表法。不引第三方依赖。 */

let table: Uint32Array | null = null

function getTable(): Uint32Array {
  if (table) return table
  const next = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let bit = 0; bit < 8; bit += 1) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    next[i] = c >>> 0
  }
  table = next
  return next
}

/** 返回 8 位小写十六进制 */
export function crc32(bytes: Uint8Array): string {
  const t = getTable()
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = t[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}
