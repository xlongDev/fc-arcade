import { useMemo, useState } from 'react'

import { Button, Kbd, Segmented } from '@/components/ui'
import { IconReset } from '@/components/icons'
import {
  assignKey,
  captureKeyCode,
  findKeyConflicts,
  unassignKey,
} from '@/input'
import { BUTTON_LABEL, NES_BUTTONS } from '@/types/input'
import type { KeyboardMap, NesButton, PlayerIndex } from '@/types/input'

function prettifyCode(code: string): string {
  if (code === 'Space') return 'Space'
  if (code === 'Enter') return 'Enter'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Arrow')) {
    return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] ?? code
  }
  if (code.startsWith('Shift')) return code.includes('Left') ? 'L-Shift' : 'R-Shift'
  if (code.startsWith('Control')) return code.includes('Left') ? 'L-Ctrl' : 'R-Ctrl'
  if (code.startsWith('Alt')) return code.includes('Left') ? 'L-Alt' : 'R-Alt'
  return code
}

interface KeyboardMappingPanelProps {
  keyboardMap: KeyboardMap
  onChange: (next: KeyboardMap) => void
  /** 是否显示「恢复默认」按钮；游戏里通常不需要，设置页需要 */
  showReset?: boolean
  onReset?: () => void
}

/**
 * 键盘映射编辑器。
 *
 * 从设置页的 KeyboardSection 抽出来，既可以在设置页用，
 * 也可以作为游戏内 Sheet/Dialog 的内容，让玩家不退出游戏就能改键位。
 */
export function KeyboardMappingPanel({
  keyboardMap,
  onChange,
  showReset = false,
  onReset,
}: KeyboardMappingPanelProps) {
  const [player, setPlayer] = useState<PlayerIndex>(0)
  const [capturing, setCapturing] = useState<NesButton | null>(null)

  const conflicts = useMemo(() => findKeyConflicts(keyboardMap), [keyboardMap])
  const conflictCodes = useMemo(
    () => new Set(conflicts.map((conflict) => conflict.code)),
    [conflicts],
  )

  const bind = async (button: NesButton) => {
    setCapturing(button)
    try {
      const code = await captureKeyCode()
      if (code) {
        const next = assignKey(keyboardMap, player, button, code, {
          exclusive: true,
          replace: true,
        })
        onChange(next)
      }
    } finally {
      setCapturing(null)
    }
  }

  const clearButton = (button: NesButton) => {
    let next = keyboardMap
    for (const code of keyboardMap[player][button]) {
      next = unassignKey(next, player, button, code)
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-text">玩家</div>
          <div className="text-xs text-faint">选择要修改键位的玩家</div>
        </div>
        <Segmented
          value={String(player)}
          onChange={(next) => setPlayer(Number(next) as PlayerIndex)}
          options={[
            { value: '0', label: '玩家 1' },
            { value: '1', label: '玩家 2' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        {NES_BUTTONS.map((button) => {
          const codes = keyboardMap[player][button]
          const isCapturing = capturing === button
          return (
            <div
              key={button}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="w-16 shrink-0 text-sm text-text md:w-14">{BUTTON_LABEL[button]}</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {codes.length === 0 ? (
                  <span className="text-xs text-faint">未绑定</span>
                ) : (
                  codes.map((code) => (
                    <Kbd
                      key={code}
                      className={
                        conflictCodes.has(code)
                          ? 'border-danger text-danger'
                          : undefined
                      }
                    >
                      {prettifyCode(code)}
                    </Kbd>
                  ))
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant={isCapturing ? 'primary' : 'secondary'}
                  onClick={() => void bind(button)}
                  disabled={capturing !== null && !isCapturing}
                >
                  {isCapturing ? '按下按键…' : '绑定'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => clearButton(button)}
                  disabled={codes.length === 0 || capturing !== null}
                >
                  清除
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {showReset ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            icon={<IconReset size={15} />}
            onClick={onReset}
            disabled={capturing !== null}
          >
            恢复默认键位
          </Button>
        </div>
      ) : null}
    </div>
  )
}
