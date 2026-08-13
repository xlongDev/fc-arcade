/**
 * DAO 实现。
 *
 * 边界约束：GameDao 永远不碰 roms 表的 blob——列表页拿到的记录必须是纯元数据。
 * 需要 ROM 本体时显式调用 romDao.getBuffer(id)，这条边界是 ROM 懒加载的基础。
 */
import { buildSearchText, normalizeTitle } from '@/metadata/text'
import type { GameRecord } from '@/types/game'
import type {
  CoverDao,
  CoverRow,
  CrcLearnDao,
  CrcLearnRow,
  GameDao,
  GameQuery,
  RomDao,
  RomRow,
  SaveSlot,
  SaveStateDao,
  SaveStateRow,
  SessionDao,
  SessionRow,
} from '@/types/storage'

import { db } from './db'
import { applyGameQuery } from './query'
import { mergeMeta, toGameView } from './view'

/**
 * 重算派生字段。titleNorm / searchText 必须反映「detected + overrides 合并后」的标题，
 * 否则用户改了标题后搜不到。所有写路径统一走这里。
 */
export function withDerivedFields(record: GameRecord): GameRecord {
  const meta = mergeMeta(record.detected, record.overrides)
  return {
    ...record,
    titleNorm: normalizeTitle(meta.title),
    searchText: buildSearchText({
      title: meta.title,
      titleAlias: meta.titleAlias,
      fileName: record.fileName,
    }),
  }
}

/** 级联删除：游戏本体 + ROM + 封面 + 存档。sessions 保留（统计用，不含大数据）。 */
async function cascadeRemove(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', [db.games, db.roms, db.covers, db.saveStates], async () => {
    const records = await db.games.bulkGet([...ids])
    const romIds = records.filter((r): r is GameRecord => Boolean(r)).map((r) => r.romId)
    await db.saveStates.where('gameId').anyOf([...ids]).delete()
    await db.covers.where('gameId').anyOf([...ids]).delete()
    if (romIds.length > 0) await db.roms.bulkDelete(romIds)
    await db.games.bulkDelete([...ids])
  })
}

export const gameDao: GameDao = {
  async list(query?: GameQuery): Promise<GameRecord[]> {
    const records = await db.games.toArray()
    if (!query) return records
    const byId = new Map(records.map((r) => [r.id, r]))
    const searchTexts = new Map(records.map((r) => [r.id, r.searchText]))
    const views = records.map(toGameView)
    const result = applyGameQuery(views, query, (view) => searchTexts.get(view.id) ?? '')
    return result
      .map((view) => byId.get(view.id))
      .filter((r): r is GameRecord => r !== undefined)
  },

  getAll(): Promise<GameRecord[]> {
    return db.games.toArray()
  },

  get(id: string): Promise<GameRecord | undefined> {
    return db.games.get(id)
  },

  findByCrc(crc32: string): Promise<GameRecord | undefined> {
    return db.games.where('rom.crc32').equals(crc32).first()
  },

  async add(record: GameRecord): Promise<string> {
    return db.games.add(withDerivedFields(record))
  },

  async bulkAdd(records: GameRecord[]): Promise<string[]> {
    if (records.length === 0) return []
    await db.games.bulkAdd(records.map(withDerivedFields))
    return records.map((r) => r.id)
  },

  async update(id: string, patch: Partial<GameRecord>): Promise<void> {
    await db.transaction('rw', db.games, async () => {
      const current = await db.games.get(id)
      if (!current) return
      // id / romId 不允许通过 patch 改写，避免破坏 games ↔ roms 的一一对应
      const next: GameRecord = {
        ...current,
        ...patch,
        id: current.id,
        romId: current.romId,
      }
      await db.games.put(withDerivedFields(next))
    })
  },

  remove(id: string): Promise<void> {
    return cascadeRemove([id])
  },

  removeMany(ids: string[]): Promise<void> {
    return cascadeRemove(ids)
  },

  count(): Promise<number> {
    return db.games.count()
  },

  async clear(): Promise<void> {
    await db.games.clear()
  },
}

export const romDao: RomDao = {
  get(id: string): Promise<RomRow | undefined> {
    return db.roms.get(id)
  },

  async getBuffer(id: string): Promise<ArrayBuffer | undefined> {
    const row = await db.roms.get(id)
    if (!row) return undefined
    return row.blob.arrayBuffer()
  },

  async put(row: RomRow): Promise<void> {
    await db.roms.put(row)
  },

  async remove(id: string): Promise<void> {
    await db.roms.delete(id)
  },

  async clear(): Promise<void> {
    await db.roms.clear()
  },
}

export const coverDao: CoverDao = {
  get(gameId: string): Promise<CoverRow | undefined> {
    return db.covers.get(gameId)
  },

  async getMany(gameIds: string[]): Promise<Map<string, CoverRow>> {
    const map = new Map<string, CoverRow>()
    if (gameIds.length === 0) return map
    const rows = await db.covers.bulkGet(gameIds)
    for (const row of rows) {
      if (row) map.set(row.gameId, row)
    }
    return map
  },

  async put(row: CoverRow): Promise<void> {
    await db.covers.put(row)
  },

  async remove(gameId: string): Promise<void> {
    await db.covers.delete(gameId)
  },

  async clear(): Promise<void> {
    await db.covers.clear()
  },
}

export const saveStateDao: SaveStateDao = {
  async listByGame(gameId: string): Promise<SaveStateRow[]> {
    const rows = await db.saveStates.where('gameId').equals(gameId).toArray()
    return rows.sort((a, b) => b.createdAt - a.createdAt)
  },

  get(id: string): Promise<SaveStateRow | undefined> {
    return db.saveStates.get(id)
  },

  getBySlot(gameId: string, slot: SaveSlot): Promise<SaveStateRow | undefined> {
    return db.saveStates.where('[gameId+slot]').equals([gameId, slot]).first()
  },

  async put(row: SaveStateRow): Promise<void> {
    // 同一个 slot 只保留最新一份，先清掉旧的再写，避免复合索引出现重复项
    await db.transaction('rw', db.saveStates, async () => {
      const existing = await db.saveStates
        .where('[gameId+slot]')
        .equals([row.gameId, row.slot])
        .toArray()
      const stale = existing.filter((r) => r.id !== row.id).map((r) => r.id)
      if (stale.length > 0) await db.saveStates.bulkDelete(stale)
      await db.saveStates.put(row)
    })
  },

  async remove(id: string): Promise<void> {
    await db.saveStates.delete(id)
  },

  async removeByGame(gameId: string): Promise<void> {
    await db.saveStates.where('gameId').equals(gameId).delete()
  },

  async clear(): Promise<void> {
    await db.saveStates.clear()
  },
}

export const sessionDao: SessionDao = {
  async add(row: SessionRow): Promise<void> {
    await db.sessions.put(row)
  },

  async recentGameIds(limit: number): Promise<string[]> {
    if (limit <= 0) return []
    const rows = await db.sessions.orderBy('startedAt').reverse().limit(limit * 8).toArray()
    const seen: string[] = []
    for (const row of rows) {
      if (!seen.includes(row.gameId)) seen.push(row.gameId)
      if (seen.length >= limit) break
    }
    return seen
  },

  async totalMsByGame(gameId: string): Promise<number> {
    let total = 0
    await db.sessions
      .where('gameId')
      .equals(gameId)
      .each((row) => {
        total += row.durationMs
      })
    return total
  },

  async clear(): Promise<void> {
    await db.sessions.clear()
  },
}

export const crcLearnDao: CrcLearnDao = {
  get(crc32: string): Promise<CrcLearnRow | undefined> {
    return db.crcLearn.get(crc32)
  },

  async put(row: CrcLearnRow): Promise<void> {
    await db.crcLearn.put(row)
  },

  getAll(): Promise<CrcLearnRow[]> {
    return db.crcLearn.toArray()
  },

  async clear(): Promise<void> {
    await db.crcLearn.clear()
  },
}
