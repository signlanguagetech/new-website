type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

type DeepReadonly<T> =
  T extends Primitive | Function
    ? T
    : T extends Map<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends Set<infer U>
        ? ReadonlySet<DeepReadonly<U>>
        : T extends Promise<infer U>
          ? Promise<DeepReadonly<U>>
          : T extends readonly (infer U)[]
            ? readonly DeepReadonly<U>[]
            : T extends object
              ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
              : T;