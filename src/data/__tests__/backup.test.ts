/**
 * 备份导出 / 导入 round-trip 测试。
 *
 * 重点验证：游戏存档（save states）能随其他数据一起被导出、预览并恢复；
 * 中文 label 在 zip 内不会乱码。
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

import type { GameRecord } from '@/types/game'
import type { CoverRow, RomRow, SaveStateRow, SessionRow } from '@/types/storage'

import { clearAllData, db } from '../db'
import {
  exportBackup,
  exportSaveStates,
  importBackup,
  importSaveStates,
  previewBackup,
  previewSaveStatesBackup,
} from '../backup'

const gameSeed: GameRecord = {
  id: 'game-测试-1',
  romId: 'rom-测试-1',
  fileName: '测试游戏.nes',
  detected: {
    title: '测试游戏',
    titleAlias: '测试别名',
    year: 1990,
    categories: ['action'],
    developer: '测试工作室',
    publisher: '测试发行',
    players: 1,
    region: 'JP',
    description: '这是测试',
    confidence: 'none',
    matchedTitleId: null,
  },
  overrides: {},
  rom: {
    crc32: 'aabbccdd',
    sizeBytes: 1024,
    mapper: 0,
    prgBanks: 1,
    chrBanks: 0,
    mirroring: 'horizontal',
    hasBattery: false,
    hasTrainer: false,
    format: 'ines',
  },
  coverKind: 'custom',
  favorite: false,
  playCount: 1,
  totalPlayMs: 60000,
  lastPlayedAt: 1700000000000,
  addedAt: 1700000000000,
  titleNorm: '测试游戏',
  searchText: '测试游戏 测试别名',
  preferredCore: null,
}

const romSeed: RomRow = {
  id: 'rom-测试-1',
  blob: new Blob([new Uint8Array([0x4e, 0x45, 0x53, 0x1a]).buffer], { type: 'application/octet-stream' }),
  size: 4,
  crc32: 'aabbccdd',
}

const coverSeed: CoverRow = {
  gameId: 'game-测试-1',
  kind: 'custom',
  blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff]).buffer], { type: 'image/jpeg' }),
  width: 256,
  height: 224,
  updatedAt: 1700000000000,
}

const saveStateSeed: SaveStateRow = {
  id: 'save-测试-1',
  gameId: 'game-测试-1',
  slot: 0,
  core: 'nostalgist',
  version: 1,
  blob: new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer], { type: 'application/octet-stream' }),
  thumb: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], { type: 'image/png' }),
  label: '中文存档标签',
  createdAt: 1700000000000,
}

const sessionSeed: SessionRow = {
  id: 'session-1',
  gameId: 'game-测试-1',
  startedAt: 1700000000000,
  durationMs: 60000,
}

async function seedDatabase(): Promise<void> {
  await db.transaction('rw', [db.games, db.roms, db.covers, db.saveStates, db.sessions], async () => {
    await db.games.put(gameSeed)
    await db.roms.put(romSeed)
    await db.covers.put(coverSeed)
    await db.saveStates.put(saveStateSeed)
    await db.sessions.put(sessionSeed)
  })
}

async function readBlobBytes(blob: Blob | null): Promise<Uint8Array> {
  if (!blob) return new Uint8Array(0)
  return new Uint8Array(await blob.arrayBuffer())
}

async function arraysEqual(a: Blob | null, b: Blob | null): Promise<boolean> {
  const ua = await readBlobBytes(a)
  const ub = await readBlobBytes(b)
  if (ua.byteLength !== ub.byteLength) return false
  for (let i = 0; i < ua.byteLength; i++) {
    if (ua[i] !== ub[i]) return false
  }
  return true
}

describe('backup round-trip', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('导出备份并预览统计', async () => {
    await seedDatabase()

    const blob = await exportBackup()
    expect(blob.size).toBeGreaterThan(0)

    const preview = await previewBackup(blob)
    expect(preview.manifest.format).toBe('fc-arcade-backup')
    expect(preview.games).toBe(1)
    expect(preview.roms).toBe(1)
    expect(preview.covers).toBe(1)
    expect(preview.saveStates).toBe(1)
    expect(preview.sessions).toBe(1)
    expect(preview.sampleTitles).toContain('测试游戏')
  })

  it('导入后恢复游戏存档', async () => {
    await seedDatabase()
    const blob = await exportBackup()

    await clearAllData()

    const summary = await importBackup(blob, { mode: 'replace' })
    expect(summary.games).toBe(1)
    expect(summary.roms).toBe(1)
    expect(summary.covers).toBe(1)
    expect(summary.saveStates).toBe(1)
    expect(summary.sessions).toBe(1)
    expect(summary.errors).toEqual([])

    const restoredGame = await db.games.get('game-测试-1')
    expect(restoredGame?.detected.title).toBe('测试游戏')

    const restoredRom = await db.roms.get('rom-测试-1')
    expect(restoredRom?.size).toBe(4)
    expect(await arraysEqual(restoredRom?.blob ?? null, romSeed.blob)).toBe(true)

    const restoredCover = await db.covers.get('game-测试-1')
    expect(restoredCover?.width).toBe(256)
    expect(await arraysEqual(restoredCover?.blob ?? null, coverSeed.blob)).toBe(true)

    const restoredSave = await db.saveStates.get('save-测试-1')
    expect(restoredSave?.slot).toBe(0)
    expect(restoredSave?.label).toBe('中文存档标签')
    expect(await arraysEqual(restoredSave?.blob ?? null, saveStateSeed.blob)).toBe(true)
    expect(await arraysEqual(restoredSave?.thumb ?? null, saveStateSeed.thumb)).toBe(true)
  })

  it('merge 模式不删除已有数据', async () => {
    await seedDatabase()
    const blob = await exportBackup()

    // 额外写一条本机独有的存档
    await db.saveStates.put({
      ...saveStateSeed,
      id: 'save-本地-2',
      slot: 1,
      label: '本地存档',
    })

    const summary = await importBackup(blob, { mode: 'merge' })
    expect(summary.saveStates).toBe(1)

    const localSave = await db.saveStates.get('save-本地-2')
    expect(localSave?.label).toBe('本地存档')

    const restoredSave = await db.saveStates.get('save-测试-1')
    expect(restoredSave?.label).toBe('中文存档标签')
  })
})

describe('save states backup only', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('单独导出存档并预览统计', async () => {
    await seedDatabase()

    const blob = await exportSaveStates()
    expect(blob.size).toBeGreaterThan(0)

    const preview = await previewSaveStatesBackup(blob)
    expect(preview.manifest.format).toBe('fc-arcade-saves')
    expect(preview.saveStates).toBe(1)
    expect(preview.games).toBe(0)
    expect(preview.roms).toBe(0)
    expect(preview.covers).toBe(0)
  })

  it('单独导入存档后恢复数据', async () => {
    await seedDatabase()
    const blob = await exportSaveStates()

    await db.saveStates.clear()
    expect(await db.saveStates.count()).toBe(0)

    const summary = await importSaveStates(blob, { mode: 'replace' })
    expect(summary.saveStates).toBe(1)
    expect(summary.errors).toEqual([])

    const restoredSave = await db.saveStates.get('save-测试-1')
    expect(restoredSave?.slot).toBe(0)
    expect(restoredSave?.label).toBe('中文存档标签')
    expect(await arraysEqual(restoredSave?.blob ?? null, saveStateSeed.blob)).toBe(true)
    expect(await arraysEqual(restoredSave?.thumb ?? null, saveStateSeed.thumb)).toBe(true)
  })

  it('merge 模式保留本机已有存档', async () => {
    await seedDatabase()
    const blob = await exportSaveStates()

    await db.saveStates.put({
      ...saveStateSeed,
      id: 'save-本地-2',
      slot: 1,
      label: '本地存档',
    })

    const summary = await importSaveStates(blob, { mode: 'merge' })
    expect(summary.saveStates).toBe(1)

    const localSave = await db.saveStates.get('save-本地-2')
    expect(localSave?.label).toBe('本地存档')

    const restoredSave = await db.saveStates.get('save-测试-1')
    expect(restoredSave?.label).toBe('中文存档标签')
  })
})
