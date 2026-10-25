import { createHash } from 'node:crypto'

/** The default seed: scenarios and fixtures are reproducible unless a test asks otherwise. */
export const DEFAULT_SCENARIO_SEED = 'toolpath-dev-config'

/** The default clock: every timestamp a default scenario writes is this instant. */
export const DEFAULT_SCENARIO_INSTANT = '2026-01-01T00:00:00.000Z'

const digest = (text: string): string => createHash('sha256').update(text).digest('hex')

/**
 * A UUID (version 4 layout) derived from a seed, a kind, and an ordinal, so the
 * same scenario issues the same identifiers in the same order on every run.
 */
export const deterministicUuid = (seed: string, kind: string, ordinal: number): string => {
  const hex = digest(`${seed}\0${kind}\0${ordinal}`)
  const variant = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** A deterministic, scenario-specific signature for a synthetic presigned URL. */
export const signStoragePath = (seed: string, path: string, expiresAt: number): string =>
  digest(`${seed}\0storage\0${path}\0${expiresAt}`).slice(0, 32)
