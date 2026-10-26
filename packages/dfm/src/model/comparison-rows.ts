import { featureTypeLabel } from './dfm-explain.js'
import { directionLabel } from './direction-label.js'
import type { ComparedFace, FeatureIdentity } from './view-types.js'

/** What a comparison row reads: one of the fixed rows, or a measurement. */
export type ComparisonRowKind = 'type' | 'direction' | 'required' | 'rules' | 'measurement'

/** A row of the comparison: what it is, each face's reading, and whether the readings disagree. */
export interface ComparisonRow {
  /** What the row reads. A view draws a row by this, never by its `key`. */
  readonly kind: ComparisonRowKind
  /**
   * A fixed row's kind, or a measurement's own `key`. A measurement can share
   * a fixed row's name, so a row is unique only by `kind` and `key` together.
   */
  readonly key: string
  readonly label: string
  /** One per face, in order: `—` for a face that has no reading. */
  readonly texts: readonly string[]
  readonly differs: boolean
}

const DASH = '—'

/** The letter a compared face goes by: A, B, C… */
export const faceLetter = (index: number): string => String.fromCharCode(65 + (index % 26))

/**
 * What each compared face was read as, row by row: its type, the way it is
 * machined from, whether it is required (only when some face says), the rules
 * it breaks, then every measurement any face has, keyed by its `key`, in the
 * order the faces first give them. A face no feature owns reads `—`
 * throughout.
 *
 * `differs` compares the texts, except on the rules row, which compares the
 * rules themselves: two faces each breaking one rule read the same count and
 * still differ when the rules do.
 */
export const comparisonRows = (faces: readonly ComparedFace[]): ComparisonRow[] => {
  const row = (
    kind: Exclude<ComparisonRowKind, 'measurement'>,
    label: string,
    read: (face: ComparedFace, feature: FeatureIdentity) => string,
  ): ComparisonRow => {
    const texts = faces.map((face) => (face.feature ? read(face, face.feature) : DASH))
    return { kind, key: kind, label, texts, differs: new Set(texts).size > 1 }
  }

  const rules = row('rules', 'Rules broken', (face) =>
    face.rules.length > 0 ? String(face.rules.length) : 'None',
  )
  const ruleKeys = faces.map((face) =>
    face.feature ? face.rules.map((rule) => rule.key).join(',') : DASH,
  )

  const fixed = [
    row('type', 'Type', (_, feature) => featureTypeLabel(feature.featureType)),
    row('direction', 'Machined from', (_, feature) => directionLabel(feature.machiningDirection)),
    ...(faces.some((face) => face.required !== undefined)
      ? [row('required', 'Required', (face) => (face.required ? 'Yes' : 'No'))]
      : []),
    { ...rules, differs: new Set(ruleKeys).size > 1 },
  ]

  const labels = new Map<string, string>()
  for (const face of faces) {
    for (const each of face.measurements) labels.set(each.key, labels.get(each.key) ?? each.label)
  }
  const measured = [...labels].map(([key, label]): ComparisonRow => {
    const texts = faces.map(
      (face) => face.measurements.find((each) => each.key === key)?.value ?? DASH,
    )
    return { kind: 'measurement', key, label, texts, differs: new Set(texts).size > 1 }
  })

  return [...fixed, ...measured]
}
