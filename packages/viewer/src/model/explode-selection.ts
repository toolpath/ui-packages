import type { FeatureHighlight, RegionHighlight } from '../render/paint.js'
import type { ExplodeGroup, ExplodeGroupIds } from './explode.js'
import type { FeatureTag } from './types.js'

/** A feature selection's key: its tags joined, so a fresh array with the same tags is no change. */
export const selectionKey = (tags: readonly FeatureTag[] | undefined): string =>
  tags?.join('\n') ?? ''

/** A paint layer's key: each entry's target, color and weight, so a fresh array is no change. */
export const paintKey = (
  layer: ReadonlyArray<FeatureHighlight | RegionHighlight> | undefined,
): string =>
  (layer ?? [])
    .map(
      (entry) =>
        `${'tag' in entry ? entry.tag : entry.region}:${entry.color}:${entry.weight ?? ''}`,
    )
    .join(' ')

/**
 * A primary click on a piece, and the feature selection it produced. While that selection
 * stands, the clicked piece keeps it to itself; once the selection moves on, so does the click.
 * Selections are compared by `selectionKey`.
 */
export interface PieceClick {
  readonly id: string
  /** The selection when the click landed. */
  readonly before: string
  /** The selection the click produced: the first that differs from `before`. */
  readonly after: string | null
}

/**
 * The click, as the selection now stands. Until the selection changes, the click holds it; the
 * first change is the click's own; any change after that comes from elsewhere, such as a list
 * row or a cleared selection, and drops the click. Read in either order: the selection may
 * arrive before the click or after it.
 */
export const settleClick = (click: PieceClick | null, selection: string): PieceClick | null => {
  if (click === null) {
    return null
  }
  if (click.after === null) {
    return selection === click.before ? click : { ...click, after: selection }
  }
  return selection === click.after ? click : null
}

const lowerCase = (tag: string): string => tag.toLowerCase()

/**
 * The pieces standing for any of `tags`. A `preferred` piece among them, the one clicked, keeps
 * its own features' selection to itself rather than lighting every copy of them; pieces
 * standing for the other tags stay lit, so a click that adds to a selection keeps the rest.
 */
export const piecesFor = (
  groups: ReadonlyArray<ExplodeGroup>,
  tags: readonly FeatureTag[] | undefined,
  preferred: string | null,
): ExplodeGroupIds => {
  if (!tags?.length) {
    return null
  }
  const wanted = new Set(tags.map(lowerCase))
  const matching = groups.filter((group) =>
    group.featureTags?.some((tag) => wanted.has(lowerCase(tag))),
  )
  const clicked = matching.find((group) => group.id === preferred)
  if (!clicked) {
    return matching.map((group) => group.id)
  }
  // The selected tags the clicked piece stands for are its own; the rest still light theirs.
  const own = new Set(clicked.featureTags!.map(lowerCase))
  const others = new Set([...wanted].filter((tag) => !own.has(tag)))
  const ids = matching
    .filter(
      (group) => group === clicked || group.featureTags!.some((tag) => others.has(lowerCase(tag))),
    )
    .map((group) => group.id)
  return ids.length === 1 ? clicked.id : ids
}

/**
 * The pieces shown as hovered: the application's own `hovered` when given, else the piece under
 * the pointer while hover is on, else the pieces standing for `hoveredFeatures`.
 */
export const hoveredPieces = (
  groups: ReadonlyArray<ExplodeGroup>,
  {
    hovered,
    hover,
    pointed,
    hoveredFeatures,
  }: {
    readonly hovered: ExplodeGroupIds | undefined
    readonly hover: boolean
    readonly pointed: string | null
    readonly hoveredFeatures: readonly FeatureTag[] | undefined
  },
): ExplodeGroupIds => {
  if (hovered !== undefined) {
    return hovered
  }
  if (hover && pointed !== null) {
    return pointed
  }
  return piecesFor(groups, hoveredFeatures, null)
}
