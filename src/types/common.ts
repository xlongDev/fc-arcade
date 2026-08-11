/** 取消订阅函数 */
export type Unsubscribe = () => void

/** 只读深层对象，用于暴露不可变的配置 */
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : T[K] extends object
      ? DeepReadonly<T[K]>
      : T[K]
}
