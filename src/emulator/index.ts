/**
 * 模拟器层对外入口。上层只从这里拿适配器，不直接 import 具体内核。
 *
 * 现状：当前只有 fceumm 一个内核（经 nostalgist 这个 libretro / RetroArch WASM 加载器加载，
 * 核心文件本地化在 public/cores/，离线可用）。nostalgist 走动态 import：
 * RetroArch 的加载器 + WASM 核心有好几 MB，只在真正要跑游戏时才下载。
 *
 * 抽象层级说明（YAGNI 边界）：EmulatorAdapter 接口 + createEmulator 工厂 + CORES 常量 +
 * CORE_DISPLAY_NAME 映射是一整套「为多内核预留」的脚手架。现阶段只有一个实现，
 * 无需新增多余分支或 switch——若要接入新内核，请在此处加 entry + 写一个 NostalgistAdapter
 * 式的实现，不要在调用方直接 import 具体内核。
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
