import { useSpring } from 'motion/react'
import type { MotionValue } from 'motion/react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface Tilt {
  rotateX: MotionValue<number>
  rotateY: MotionValue<number>
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerLeave: () => void
}

/** 指针跟随的轻微 3D 倾斜。幅度刻意压在 6 度以内，避免像玩具。 */
export function useTilt(enabled: boolean, maxDeg = 6): Tilt {
  const rotateX = useSpring(0, { stiffness: 260, damping: 22, mass: 0.5 })
  const rotateY = useSpring(0, { stiffness: 260, damping: 22, mass: 0.5 })

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || event.pointerType === 'touch') return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const px = (event.clientX - rect.left) / rect.width - 0.5
    const py = (event.clientY - rect.top) / rect.height - 0.5
    rotateY.set(px * maxDeg * 2)
    rotateX.set(-py * maxDeg * 2)
  }

  const onPointerLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  return { rotateX, rotateY, onPointerMove, onPointerLeave }
}
