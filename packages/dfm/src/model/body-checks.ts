import type { DfmCheck, DfmHit } from './dfm-flags.js'
import { CRITICAL_COLOR, type DfmRule } from './dfm-rules.js'
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
  /** How many bodies have a finished check. */
  completed: number
  /** How many bodies there are, finished or not. */
  total: number
  /** How many bodies' checks failed; they never finish, so they are not waited on. */
  failed: number
  features: Array<BodyDfmFeature>
  violations: Array<BodyDfmViolation>
  byRule: Array<{ rule: DfmRule; count: number }>
}

/** How badly a rule is broken: critical where its colour is the critical red, a warning otherwise. */
export type DfmSeverity = 'warning' | 'critical'

/**
 * A rule's severity. The colour is how much a rule matters (see
 * {@link CRITICAL_COLOR}): the critical red is critical and any other colour
 * a warning.
 */
export const ruleSeverity = (rule: DfmRule): DfmSeverity =>
  rule.color.toLowerCase() === CRITICAL_COLOR ? 'critical' : 'warning'

/**
 * The worst severity of each required feature that breaks a rule, by
 * lower-cased tag as `check.required` and `check.hitsByTag` spell it. A
 * feature that breaks a critical rule is critical whatever else it breaks.
 */
export const featureSeverities = (check: DfmCheck): Map<string, DfmSeverity> => {
  const severities = new Map<string, DfmSeverity>()
  for (const tag of check.required) {
    const hits = check.hitsByTag.get(tag) ?? []
    if (hits.length === 0) {
      continue
    }
    severities.set(
      tag,
      hits.some((hit) => ruleSeverity(hit.rule) === 'critical') ? 'critical' : 'warning',
    )
  }
  return severities
}

/** Features grouped by their type, the types in the order they first appear. */
export const featuresByType = (
  features: ReadonlyArray<DfmFeature>,
): Array<{ featureType: string; features: Array<DfmFeature> }> => {
  const groups = new Map<string, { featureType: string; features: Array<DfmFeature> }>()
  for (const feature of features) {
    const group = groups.get(feature.featureType) ?? {
      featureType: feature.featureType,
      features: [],
    }
    group.features.push(feature)
    groups.set(feature.featureType, group)
  }
  return [...groups.values()]
}

/**
 * The bodies that break each rule, by rule id, with their violations of it;
 * the bodies in the summary's order. A rule nothing breaks has no entry.
 */
export const bodiesByRule = (
  summary: BodyDfmSummary,
): Map<string, Array<{ body: BodyDfmCheck; violations: Array<BodyDfmViolation> }>> => {
  const ownViolations = new Map<string, Array<BodyDfmViolation>>()
  for (const violation of summary.violations) {
    const own = ownViolations.get(violation.bodyId) ?? []
    own.push(violation)
    ownViolations.set(violation.bodyId, own)
  }
  const byRule = new Map<
    string,
    Array<{ body: BodyDfmCheck; violations: Array<BodyDfmViolation> }>
  >()
  for (const body of summary.bodies) {
    for (const violation of ownViolations.get(body.id) ?? []) {
      const entries = byRule.get(violation.rule.id) ?? []
      const last = entries.at(-1)
      if (last?.body === body) {
        last.violations.push(violation)
      } else {
        entries.push({ body, violations: [violation] })
      }
      byRule.set(violation.rule.id, entries)
    }
  }
  return byRule
}

/**
 * Combines independently checked parts. Region numbers and feature tags remain
 * local to each body. Throws where two bodies share an id. A body's result for
 * a rule not in `rules` is left out, so `violations` and `byRule` agree and
 * each violation's `rule` is the one passed in.
 */
export const combineBodyChecks = (
  bodies: ReadonlyArray<BodyDfmCheck>,
  rules: ReadonlyArray<DfmRule>,
): BodyDfmSummary => {
  if (new Set(bodies.map((body) => body.id)).size !== bodies.length) {
    throw new Error('Body ids must be unique.')
  }
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]))
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
      const rule = ruleById.get(result.rule.id)
      if (!rule) {
        continue
      }
      for (const tag of result.tags) {
        const feature = own.get(tag.toLowerCase())
        if (!feature) {
          continue
        }
        violations.push({
          id: JSON.stringify([body.id, rule.id, feature.tag]),
          bodyId: body.id,
          bodyLabel: body.label,
          feature,
          rule,
          hit:
            body.check?.hitsByTag.get(tag.toLowerCase())?.find((hit) => hit.rule.id === rule.id) ??
            null,
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
