/** Small structural guards for narrowing untyped response bodies. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/** A thrown value as an `Error`, wrapping anything that is not one. */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}
