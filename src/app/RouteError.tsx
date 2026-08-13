import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'

import { Button } from '@/components/ui'
import { IconAlert, IconHome, IconRefresh } from '@/components/icons'

/** 路由级错误页：loader / 渲染阶段抛错时由 react-router 展示 */
export function RouteError() {
  const error = useRouteError()
  const navigate = useNavigate()

  let title = '出了点问题'
  let detail = '发生了未预期的错误，可以刷新重试。'

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    detail = typeof error.data === 'string' ? error.data : detail
  } else if (error instanceof Error) {
    detail = error.message
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-8 backdrop-blur-[var(--glass-blur)]">
        <p className="flex items-center gap-2 text-[var(--color-danger)]">
          <IconAlert size={20} />
          <span className="font-pixel text-sm">{title}</span>
        </p>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant="primary"
            icon={<IconRefresh size={16} />}
            onClick={() => window.location.reload()}
          >
            刷新页面
          </Button>
          <Button
            variant="secondary"
            icon={<IconHome size={16} />}
            onClick={() => void navigate('/')}
          >
            回到游戏库
          </Button>
        </div>
      </div>
    </div>
  )
}
