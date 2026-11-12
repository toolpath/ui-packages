/** `{ [key]: value }` when the value is present, `{}` otherwise: an optional field spread into a record. */
export const optional = <K extends string, V>(
  key: K,
  value: V | undefined,
): Partial<Record<K, V>> => (value === undefined ? {} : ({ [key]: value } as Record<K, V>))
