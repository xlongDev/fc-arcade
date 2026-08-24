/**
 * 主题定义聚合入口。
 *
 * 每个主题独立存放在 ./themes/<Name>.ts（数据文件，仅含纯数据 + 中文文案注释），
 * 这里只做 import 聚合与 THEME_LIST 排序，不再内联 24 套主题的大对象，
 * 保持首屏与 diff 噪声都更小。新增主题：在 ./themes 加一个文件并在 THEMES 里补一行。
 */
import type { ThemeDefinition, ThemeId } from '@/types/theme'
import { THEME_IDS } from '@/types/theme'

import { famicom } from './themes/famicom'
import { nesGray } from './themes/nesGray'
import { mario } from './themes/mario'
import { adventureIsland } from './themes/adventureIsland'
import { contra } from './themes/contra'
import { megaman } from './themes/megaman'
import { zelda } from './themes/zelda'
import { metroid } from './themes/metroid'
import { kirby } from './themes/kirby'
import { tetris } from './themes/tetris'
import { gameboy } from './themes/gameboy'
import { crtAmber } from './themes/crtAmber'
import { neonArcade } from './themes/neonArcade'
import { pacman } from './themes/pacman'
import { castlevania } from './themes/castlevania'
import { synthwave } from './themes/synthwave'
import { woodgrain } from './themes/woodgrain'
import { streetFighter } from './themes/streetFighter'
import { sonic } from './themes/sonic'
import { vaporwave } from './themes/vaporwave'
import { gamegear } from './themes/gamegear'
import { souls } from './themes/souls'
import { dos } from './themes/dos'
import { c64 } from './themes/c64'
import { duckHunt } from './themes/duckHunt'
import { bubbleBobble } from './themes/bubbleBobble'
import { punchOut } from './themes/punchOut'
import { excitebike } from './themes/excitebike'
import { balloonFight } from './themes/balloonFight'
import { drMario } from './themes/drMario'
import { tecmoBowl } from './themes/tecmoBowl'
import { kidIcarus } from './themes/kidIcarus'

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  famicom,
  'nes-gray': nesGray,
  mario,
  'adventure-island': adventureIsland,
  contra,
  megaman,
  zelda,
  metroid,
  kirby,
  tetris,
  gameboy,
  'crt-amber': crtAmber,
  'neon-arcade': neonArcade,
  pacman,
  castlevania,
  synthwave,
  woodgrain,
  'street-fighter': streetFighter,
  sonic,
  vaporwave,
  gamegear,
  souls,
  dos,
  c64,
  'duck-hunt': duckHunt,
  'bubble-bobble': bubbleBobble,
  'punch-out': punchOut,
  'excitebike': excitebike,
  'balloon-fight': balloonFight,
  'dr-mario': drMario,
  'tecmo-bowl': tecmoBowl,
  'kid-icarus': kidIcarus,
}

/** 按 THEM 的顺序排列，主题选择器直接消费 */
export const THEME_LIST: ThemeDefinition[] = THEME_IDS.map((id) => THEMES[id])
