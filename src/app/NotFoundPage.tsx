import { useNavigate } from 'react-router'
import { motion } from 'motion/react'

import { Button } from '@/components/ui'
import { IconHome } from '@/components/icons'
import { SPRING } from '@/features/common/motion'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <motion.p
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING}
        className="font-pixel text-5xl text-[var(--color-accent)]"
      >
        404
      </motion.p>
      <div>
        <p className="text-lg font-medium text-[var(--color-text)]">这张卡带插歪了</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          没有找到这个页面，吹一吹卡槽再回游戏库看看。
        </p>
      </div>
      <Button variant="primary" icon={<IconHome size={16} />} onClick={() => void navigate('/')}>
        回到游戏库
      </Button>
    </div>
  )
}
