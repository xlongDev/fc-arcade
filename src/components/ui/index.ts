/**
 * FC Arcade 基础组件库统一出口。
 *
 * 约定：
 * - 颜色 / 圆角 / 阴影一律走 src/styles/index.css 里的 token，组件内没有任何写死的十六进制色，
 *   这样 13 套主题在运行时覆写 CSS 变量时组件会跟着变。
 * - 表单类组件的 onChange 给的是「值」不是 event（Input 给 string、Switch 给 boolean…），
 *   调用方不用再写 e.target.value。
 * - 焦点态统一 focus-ring，弹层统一走 portal + Escape + 焦点陷阱。
 */

export { Badge } from './Badge'
export type { BadgeProps, BadgeSize, BadgeVariant } from './Badge'

export { Button } from './Button'
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button'

export { Card } from './Card'
export type { CardProps, CardVariant } from './Card'

export { Checkbox } from './Checkbox'
export type { CheckboxProps } from './Checkbox'

export { ConfirmDialog } from './ConfirmDialog'
export type { ConfirmDialogProps } from './ConfirmDialog'

export { Dialog } from './Dialog'
export type { DialogProps, DialogSize } from './Dialog'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { IconButton } from './IconButton'
export type { IconButtonProps, IconButtonSize, IconButtonVariant } from './IconButton'

export { Input } from './Input'
export type { InputProps, InputSize } from './Input'

export { Kbd } from './Kbd'
export type { KbdProps } from './Kbd'

export { NumberInput } from './NumberInput'
export type { NumberInputProps } from './NumberInput'

export { Popover } from './Popover'
export type { PopoverProps } from './Popover'

export { ProgressBar } from './ProgressBar'
export type { ProgressBarProps, ProgressVariant } from './ProgressBar'

export { Segmented, SegmentedControl } from './Segmented'
export type { SegmentedOption, SegmentedProps } from './Segmented'

export { Select } from './Select'
export type { SelectOption, SelectProps } from './Select'

export { Sheet } from './Sheet'
export type { SheetProps, SheetSide } from './Sheet'

export { Skeleton } from './Skeleton'
export type { SkeletonProps } from './Skeleton'

export { Slider } from './Slider'
export type { SliderProps } from './Slider'

export { Spinner } from './Spinner'
export type { SpinnerProps, SpinnerSize } from './Spinner'

export { Switch } from './Switch'
export type { SwitchProps } from './Switch'

export { Tabs } from './Tabs'
export type { TabItem, TabsProps } from './Tabs'

export { Textarea } from './Textarea'
export type { TextareaProps } from './Textarea'

export { ToastViewport, useToast } from './Toast'
export type { ToastApi } from './Toast'
export { dismissAllToasts, dismissToast, pushToast } from './toastStore'
export type { ToastInput } from './toastStore'

export { Tooltip } from './Tooltip'
export type { TooltipProps } from './Tooltip'

export type { AnchorAlign, AnchorSide } from './anchor'
export { usePrefersReducedMotion } from './usePrefersReducedMotion'
