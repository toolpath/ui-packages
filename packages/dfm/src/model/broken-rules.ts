import { hitFigure } from './dfm-explain.js'
import type { DfmCheck, DfmHit } from './dfm-flags.js'
import { compareColors, describeRule } from './dfm-rules.js'
import type { Units } from './units.js'

/**
 * A rule a feature breaks, as a row of its details says it: a coloured dot,
 * the rule, and the figure that broke it. Neutral, so an app with rules of its
 * own — the quoting app's, by severity — fills it from those, and an app on
 * this package's checker fills it with {@link brokenRules}.
 */
export interface BrokenRule {
  /** Unique among one feature's rows: the rule's id. */
  readonly key: string
  /** The dot: the rule's colour, or the app's colour for its severity. */
  readonly color: string
  /** The rule: `Holes with L/D to top of part ≥ 8`, or a short label where `limit` says the rest. */
  readonly text: string
  /** What the feature measured: `9.8`. Absent for a yes/no. */
  readonly figure?: string
  /** The line it crossed, where `text` does not already say it: `≥ 8`. */
  readonly limit?: string
  /** On hover: the rule written out, and why it matters. */
  readonly note?: string
}

/**
 * A feature's hits, the one whose colour it is painted first: red before
 * yellow, by the palette's order (`compareColors`), never the list's.
 */
const byColor = (hits: readonly DfmHit[]): DfmHit[] =>
  [...hits].sort((a, b) => compareColors(a.rule.color, b.rule.color))

/**
 * The hits worth listing for a feature: the worst of those on each measure —
 * L/D ≥ 12 says all that L/D ≥ 8 does, and more — the one it is painted for
 * first.
 */
export const worstHits = (hits: readonly DfmHit[]): DfmHit[] => {
  const seen = new Set<string>()
  return byColor(hits).filter((hit) => {
    if (seen.has(hit.metric.key)) return false
    seen.add(hit.metric.key)
    return true
  })
}

/** The rules a feature breaks, as its details list them: one a measure, the worst, palette first. */
export const brokenRules = (check: DfmCheck, tag: string, units: Units): BrokenRule[] =>
  worstHits(check.hitsByTag.get(tag.toLowerCase()) ?? []).map((hit) => {
    const figure = hitFigure(hit, units)
    return {
      key: hit.rule.id,
      color: hit.rule.color,
      text: describeRule(hit.rule, units),
      ...(figure ? { figure } : {}),
    }
  })

/**
 * The colour a feature is painted on the part: the one earliest in the
 * palette of the rules it breaks, for a required feature. Read from a face
 * painted alone (`region`), that face's colour where it is painted for this
 * feature; a feature painted whole, its colour. Undefined otherwise.
 */
export const featureColor = (
  check: DfmCheck,
  tag: string,
  region: number | null = null,
): string | undefined => {
  const key = tag.toLowerCase()
  const face = region === null ? undefined : check.paintedFaces.get(region)
  if (face && face.tag.toLowerCase() === key) return face.color
  const whole = check.paintedWhole.get(key)
  if (whole) return whole.color
  if (!check.required.has(key)) return undefined
  return byColor(check.hitsByTag.get(key) ?? [])[0]?.rule.color
}
