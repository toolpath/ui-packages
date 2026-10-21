import type { PlanDirection } from './engine-plan'

/*
  What is not machined, and why, read the one way every page reads it: a feature is not machined when
  nothing in the plan cuts its faces (`classifyFaces`). Toolpath's own per-setup `unmachined` lists
  are one reason among several, not the definition: they miss a feature no setup took on at all.
*/

/**
 * Why a feature is left: Toolpath gave it to a setup whose passes leave it (`planned`); left it out of
 * every setup (`leftOut`, with a setup facing its way, if one does); no feature includes the face; or
 * a pass roughs it but none finishes it (`notFinished`). Setups by index.
 */
export type NotMachinedWhy =
  | { kind: 'planned'; setup: number }
  | { kind: 'leftOut'; setup: number | null }
  | { kind: 'noFeature' }
  | { kind: 'notFinished'; setup: number }

/**
 * The one reason a list leads with: what the feature's own flag says of the tool or the corner,
 * as the more telling, else what the plan did with it.
 */
export type NotMachinedReason = NotMachinedWhy['kind'] | 'library' | 'sharpCorner'

/**
 * Each reason in a few words, for a chip or a count: `2 · not planned`. What happened, not a cause
 * the plan never gave: Toolpath says which features it leaves, not why.
 */
export const REASON_SHORT: Record<NotMachinedReason, string> = {
  library: 'no tool in your libraries',
  sharpCorner: 'corner too sharp',
  planned: 'planned, not cut',
  leftOut: 'not planned',
  noFeature: 'not a feature',
  notFinished: 'not finished',
}

/** A reason said in full: its few words, then what it means here — `Not planned: in no setup`. */
export const reasonLine = (reason: NotMachinedReason, detail: string): string =>
  `${REASON_SHORT[reason].charAt(0).toUpperCase()}${REASON_SHORT[reason].slice(1)}: ${detail}`

/** A feature (or a face no feature includes) the plan leaves, as the DFM check stores it. */
export interface NotMachinedFeature {
  /** Null for a face no feature includes. */
  tag: string | null
  /** The analysis's feature type, `blind_hole`; absent for a face no feature includes. */
  type?: string
  /** The faces left, and their area (mm²). */
  regions: Array<number>
  area: number
  why: NotMachinedWhy
  /** Its machining direction. */
  direction?: PlanDirection
  /** For a hole: its bore and depth, mm. */
  hole?: { diameter: number; depth: number }
}

/** A setup as Toolpath plans it: enough to say why a feature is left. */
interface PlannedSetup {
  idx?: number
  direction?: PlanDirection | null
  unmachined?: ReadonlyArray<string> | null
  actions: ReadonlyArray<{ featureTags?: ReadonlyArray<string> | null }>
}

const indexOf = (setups: ReadonlyArray<PlannedSetup>, at: number): number => setups[at]!.idx ?? at

/** Two directions alike to within rounding: a feature's and a setup's are read separately. */
const alike = (a: PlanDirection, b: PlanDirection): boolean =>
  a.x * b.x + a.y * b.y + a.z * b.z > 0.9999

/** A direction looking up at the part: work cut from below. */
export const isFromBelow = (direction: PlanDirection | null | undefined): boolean =>
  (direction?.z ?? 0) < -0.5

/** Why a feature nothing machines is left. */
export const whyOf = (
  tag: string | null,
  setups: ReadonlyArray<PlannedSetup>,
  direction: PlanDirection | null,
): NotMachinedWhy => {
  if (tag === null) {
    return { kind: 'noFeature' }
  }
  const key = tag.toLowerCase()
  const planned = setups.findIndex((setup) =>
    (setup.unmachined ?? []).some((each) => each.toLowerCase() === key),
  )
  if (planned >= 0) {
    return { kind: 'planned', setup: indexOf(setups, planned) }
  }
  const facing = direction
    ? setups.findIndex((setup) => setup.direction && alike(setup.direction, direction))
    : -1
  return { kind: 'leftOut', setup: facing >= 0 ? indexOf(setups, facing) : null }
}

/** What a setup roughs but no pass finishes: on its `unmachined` list, yet one of its passes cuts it. */
export const notFinishedIn = (setup: PlannedSetup): Array<string> => {
  const cut = new Set(
    setup.actions.flatMap((action) => action.featureTags ?? []).map((tag) => tag.toLowerCase()),
  )
  return [...new Set(setup.unmachined ?? [])].filter((tag) => cut.has(tag.toLowerCase()))
}

/** Every feature a plan roughs but never finishes, each once, with the first setup that roughs it. */
export const notFinishedOf = (
  setups: ReadonlyArray<PlannedSetup>,
): Array<{ tag: string; setup: number }> => {
  const seen = new Set<string>()
  return setups.flatMap((setup, at) =>
    notFinishedIn(setup).flatMap((tag) => {
      if (seen.has(tag.toLowerCase())) {
        return []
      }
      seen.add(tag.toLowerCase())
      return [{ tag, setup: indexOf(setups, at) }]
    }),
  )
}

/** The reason in words, given what names a setup — or none, where the list already says where. */
export const whyText = (
  why: NotMachinedWhy,
  setupName?: (setup: number) => string | null,
): string => {
  if (why.kind === 'noFeature') {
    return reasonLine(why.kind, 'nothing can be told to cut this face')
  }
  const name = why.setup === null ? null : (setupName?.(why.setup) ?? null)
  if (why.kind === 'notFinished') {
    return reasonLine(
      why.kind,
      name ? `roughed in ${name}, but no pass finishes it` : 'roughed, but no pass finishes it',
    )
  }
  if (why.kind === 'planned') {
    return reasonLine(why.kind, name ? `in ${name}, but no pass cuts it` : 'no pass cuts it')
  }
  return reasonLine(why.kind, name ? `in no setup, though ${name} faces its way` : 'in no setup')
}
