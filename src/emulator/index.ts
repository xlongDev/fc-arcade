/**
 * 模拟器层对外入口。上层只从这里拿适配器，不直接 import 具体内核。
 *
 * jsnes 是默认内核，静态导入 —— 它是纯 JS，体积小，首屏就要能用。
 * nostalgist 走动态 import：RetroArch 的加载器 + WASM 核心有好几 MB，
 * 只有用户真的在设置里切过去时才应该被下载。
 */
import type { EmulatorAdapter, EmulatorCore } from '@/types/emulator'
import { EmulatorError } from '@/types/emulator'
import { JsnesAdapter } from './jsnes/JsnesAdapter'

export { JsnesAdapter } from './jsnes/JsnesAdapter'

export async function createEmulator(core: EmulatorCore): Promise<EmulatorAdapter> {
  if (core === 'jsnes') {
    // 静态导入：跨层契约要求本模块直接 re-export JsnesAdapter，
    // 那它必然进入本 chunk，再写 await import() 只会得到一个假的分包
    // （rolldown 会报 INEFFECTIVE_DYNAMIC_IMPORT 并把它合并回来）。
    return new JsnesAdapter()
  }

  if (core === 'nostalgist') {
    try {
      const { NostalgistAdapter } = await import('./nostalgist/NostalgistAdapter')
      return new NostalgistAdapter()
    } catch (cause) {
      // 这里失败的是 chunk 本身没下载下来（离线 / CDN 挂了），不是核心 WASM
      throw new EmulatorError('core-load-failed', 'RetroArch 内核模块加载失败，请检查网络连接', {
        cause,
      })
    }
  }

  throw new EmulatorError('core-load-failed', `未知的模拟器内核：${String(core)}`)
}
