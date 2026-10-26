import type { DfmCheck, DfmHit } from './dfm-flags.js'
import type { DfmRule } from './dfm-rules.js'
import type { DfmFeature } from './geometry.js'

export interface BodyDfmCheck {
  id: string
  label: string
  status: 'pending' | 'ready' | 'error'
  /** Application-supplied analysis progress, from 0 to 100. */
  progress?: number | null
  check: DfmCheck | null
  features: ReadonlyArray<DfmFeature>
  error?: string
}

export interface BodyDfmFeature {
  id: string
  bodyId: string
  bodyLabel: string
  feature: DfmFeature
}

export interface BodyDfmViolation extends BodyDfmFeature {
  rule: DfmRule
  hit: DfmHit | null
}

export interface BodyDfmSummary {
  bodies: ReadonlyArray<BodyDfmCheck>
  completed: number
  total: number
  failed: number
  features: Array<BodyDfmFeature>
  violations: Array<BodyDfmViolation>
  byRule: Array<{ rule: DfmRule; count: number }>
}

/** Combines independently checked parts. Region numbers and feature tags remain local to each body. */
export const combineBodyChecks = (
  bodies: ReadonlyArray<BodyDfmCheck>,
  rules: ReadonlyArray<DfmRule>,
): BodyDfmSummary => {
  if (new Set(bodies.map((body) => body.id)).size !== bodies.length) {
    throw new Error('Body ids must be unique.')
  }
  const features: Array<BodyDfmFeature> = []
  const violations: Array<BodyDfmViolation> = []
  for (const body of bodies) {
    if (body.status !== 'ready') {
      continue
    }
    const own = new Map(body.features.map((feature) => [feature.tag.toLowerCase(), feature]))
    for (const feature of body.features) {
      features.push({
        id: JSON.stringify([body.id, feature.tag]),
        bodyId: body.id,
        bodyLabel: body.label,
        feature,
      })
    }
    for (const result of body.check?.byRule ?? []) {
      for (const tag of result.tags) {
        const feature = own.get(tag.toLowerCase())
        if (!feature) {
          continue
        }
        violations.push({
          id: JSON.stringify([body.id, result.rule.id, feature.tag]),
          bodyId: body.id,
          bodyLabel: body.label,
          feature,
          rule: result.rule,
          hit:
            body.check?.hitsByTag
              .get(tag.toLowerCase())
              ?.find((hit) => hit.rule.id === result.rule.id) ?? null,
        })
      }
    }
  }
  return {
    bodies,
    completed: bodies.filter((body) => body.status === 'ready').length,
    total: bodies.length,
    failed: bodies.filter((body) => body.status === 'error').length,
    features,
    violations,
    byRule: rules.map((rule) => ({
      rule,
      count: violations.filter((violation) => violation.rule.id === rule.id).length,
    })),
  }
}
