/**
 * A JSON-shaped value with every object's keys sorted, at every depth: what makes two equal values
 * stringify alike. (A replacer array would sort the top level, but also drop every nested key not in
 * it — a rule's `time` would read `{}` and a changed factor would change nothing.)
 */
export const sortedKeys = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sortedKeys)
    : typeof value === 'object' && value !== null
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, sortedKeys((value as Record<string, unknown>)[key])]),
        )
      : value

/** Whether two JSON-shaped values are the same, whatever the order of their properties. */
export const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(sortedKeys(a)) === JSON.stringify(sortedKeys(b))
