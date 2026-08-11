import clsx, { type ClassValue } from 'clsx'

/** 条件类名拼接 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
