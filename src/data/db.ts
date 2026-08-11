/**
 * Dexie 实例与 schema。
 *
 * 分层原则（强制）：games 表只存 KB 级元数据，列表页只查它；
 * ROM 二进制单独放 roms 表，只有进播放器时才按 id 取。DAO 层不提供任何 join。
 *
 * ── 索引设计说明 ────────────────────────────────────────────────
 * IndexedDB 只能索引「合法 key」（number / string / Date / ArrayBuffer / Array），
 * 且可以走点号路径索引嵌套字段。据此做了如下取舍：
 *
 * 走索引：
 *   - id           主键
 *   - romId        唯一索引，1 game ↔ 1 rom
 *   - rom.crc32    查重（导入时按 CRC 判断是否已存在）
 *   - titleNorm    标题排序 / 前缀查找
 *   - addedAt / lastPlayedAt / playCount / totalPlayMs   排序
 *
 * 走内存过滤（刻意不建索引）：
 *   - favorite     boolean 不是合法 IndexedDB key，建了也索引不到记录
 *   - year         在 detected.year，可能为 null（null 不是合法 key），
 *                  而且 overrides.year 会覆盖它，索引值与展示值会不一致
 *   - categories   同上，且是数组 + 可被 overrides 覆盖
 *   - keyword      需要模糊 / 拼音首字母匹配，索引帮不上忙
 *
 * 库规模是几百条量级（一条元数据 ~1KB），全量读出来在内存里过滤耗时可忽略，
 * 换来的是「detected + overrides 合并后的真实值」一定和过滤结果一致，
 * 不需要维护冗余镜像字段，也就没有镜像失步的 bug。
 */
import Dexie, { type Table } from 'dexie'

import type { GameRecord } from '@/types/game'
import type { CoverRow, CrcLearnRow, RomRow, SaveStateRow, SessionRow } from '@/types/storage'
import { DB_NAME, DB_VERSION } from '@/types/storage'

export interface FcArcadeDatabase extends Dexie {
  games: Table<GameRecord, string>
  roms: Table<RomRow, string>
  covers: Table<CoverRow, string>
  saveStates: Table<SaveStateRow, string>
  sessions: Table<SessionRow, string>
  crcLearn: Table<CrcLearnRow, string>
}

export const db = new Dexie(DB_NAME) as FcArcadeDatabase

db.version(DB_VERSION).stores({
  games: 'id, &romId, rom.crc32, titleNorm, addedAt, lastPlayedAt, playCount, totalPlayMs',
  roms: 'id, crc32',
  covers: 'gameId',
  saveStates: 'id, gameId, [gameId+slot], createdAt',
  sessions: 'id, gameId, startedAt',
  crcLearn: 'crc32',
})

/** 清空全部本地数据（不删库，避免其他标签页持有的连接被阻塞） */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.games, db.roms, db.covers, db.saveStates, db.sessions, db.crcLearn],
    async () => {
      await Promise.all([
        db.games.clear(),
        db.roms.clear(),
        db.covers.clear(),
        db.saveStates.clear(),
        db.sessions.clear(),
        db.crcLearn.clear(),
      ])
    },
  )
}
