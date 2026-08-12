/**
 * 模拟器层对外入口。上层只从这里拿适配器，不直接 import 具体内核。
 *
 * 目前唯一的内核是 fceumm（通过 nostalgist 这个 libretro / RetroArch WASM 加载器加载，
 * 核心文件本地化在 public/cores/，离线可用）。nostalgist 走动态 import：
 * RetroArch 的加载器 + WASM 核心有好几 MB，只在真正要跑游戏时才下载。
 */
import type { EmulatorAdapter, EmulatorCore } from '@/types/emulator'
import { EmulatorError } from '@/types/emulator'

export async function createEmulator(core: EmulatorCore): Promise<EmulatorAdapter> {
  try {
    const { NostalgistAdapter } = await import('./nostalgist/NostalgistAdapter')
    return new NostalgistAdapter()
  } catch (cause) {
    throw new EmulatorError(
      'core-load-failed',
      `RetroArch（${core}）内核模块加载失败，请检查网络连接`,
      { cause },
    )
  }
}
