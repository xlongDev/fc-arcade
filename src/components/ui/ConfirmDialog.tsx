import type { ConfirmOptions } from '@/types/ui'

import { Button } from './Button'
import { Dialog } from './Dialog'

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean
  /** 确认按钮转圈并锁住整个弹窗（含 Escape / 点遮罩） */
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 二次确认。删除、清空数据这类不可逆操作走它。
 * props 直接复用 @/types/ui 的 ConfirmOptions，跟 features 层现有的同名组件保持同一套契约。
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? () => undefined : onCancel}
      title={title}
      size="sm"
      hideCloseButton={loading}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      {description === undefined ? null : (
        <p className="text-sm leading-relaxed text-muted">{description}</p>
      )}
    </Dialog>
  )
}
