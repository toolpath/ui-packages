import type { ExplodeGroup, ExplodeGroupIds } from './explode.js'
import type { FeatureTag } from './types.js'

/**
 * A primary click on a piece, and the feature selection it produced. While that selection
 * stands, the clicked piece keeps it to itself; once the selection moves on, so does the click.
 * Selections are compared by key: their feature tags joined.
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
 * The pieces standing for any of `tags`, or the one `preferred` among them: a clicked piece
 * keeps its selection to itself rather than lighting every copy of its feature.
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
  const ids = groups
    .filter((group) => group.featureTags?.some((tag) => wanted.has(lowerCase(tag))))
    .map((group) => group.id)
  return preferred !== null && ids.includes(preferred) ? preferred : ids
}
