import type { ArtifactState } from './artifact-state'
import { moveFor, type PartStage, type StageMove } from './part-stage'
import {
  isSignedOff,
  partStateOf,
  type PartState,
  type PartStateInput,
  type PartStateKind,
} from './part-state'
import type { quoteStatus } from './quote-status'

/*
  Where an assembly stands: one uploaded file, its parts moving, approved and quoted together. The
  stage, the approval, the quantity and No quote are the assembly's; each part keeps its own
  pipeline, plan and estimate, read by its own rules (`partStateOf`, `artifactStateOf`, `moveFor`)
  with its assembly's stage and approval. These combine them. The row an upload is kept on is the
  assembly's first part from the start: `inspecting` while the file is read or its parts are made (a
  held send, read through `holding`), `inspection_failed` once that failed.

  A part counted 0 per assembly is not made (`partMade`): it is not priced or ordered, needs no plan
  for the assembly to be signed off, and its state does not stand for the assembly's while another
  part is made. At least one part of an assembly stays made by a count or a delete (`countRefusal`,
  `deleteRefusal`). A part the shop has not marked (`unmarked`, `partMarked`) is a body of its file,
  not quoted: counted 0, whatever its shape or override says.
*/

/** One part of an assembly, as its rules read it. Its stage is its assembly's. */
export interface AssemblyMember {
  partId: string
  state: PartState
  plan: ArtifactState
  estimate: ArtifactState
  /** Its count per assembly (`countPerAssembly`); 0 is a part not made. */
  count: number
}

/** The parts made — counted above 0 — which the assembly's state, moves and sign-off read. */
const madeOf = <Part extends Pick<AssemblyMember, 'count'>>(
  parts: ReadonlyArray<Part>,
): ReadonlyArray<Part> => parts.filter((part) => part.count > 0)

/** What an assembly keeps of its approval: its stage, and whether its estimate is approved. */
export interface AssemblyApproval {
  stage: PartStage
  approved: boolean
}

/**
 * A part's state in its assembly (`partStateOf`), read with the assembly's stage and approval in
 * place of its own.
 */
export const partStateInAssembly = (
  part: Omit<PartStateInput, 'stage' | 'estimateComplete'>,
  assembly: AssemblyApproval,
): PartState => partStateOf({ ...part, stage: assembly.stage, estimateComplete: assembly.approved })

/**
 * What an assembly's stage needs, from its parts: available once every part's is; else failed if
 * any part's failed, else pending if any is; else not requested.
 */
export const combinedArtifact = (states: ReadonlyArray<ArtifactState>): ArtifactState => {
  if (states.length > 0 && states.every((state) => state === 'available')) {
    return 'available'
  }
  if (states.includes('failed')) {
    return 'failed'
  }
  if (states.includes('pending')) {
    return 'pending'
  }
  return 'not-requested'
}

/**
 * How bad a part's state is for its assembly, worst first: what Toolpath can no longer do, then
 * what it refused (a file before a model), then what it is still reading or working on (a file
 * before a model), and last a part priced.
 */
const SEVERITY: Record<PartStateKind, number> = {
  gone: 0,
  inspection_failed: 1,
  analysis_failed: 2,
  plan_failed: 3,
  update_failed: 4,
  inspecting: 5,
  analyzing: 6,
  planning: 7,
  updating: 8,
  priced: 9,
}
/** Among parts priced, the edited before the not, and the less reviewed before the more. */
const REVIEW_SEVERITY = ['new', 'confirmed', 'approved'] as const

const severity = (state: PartState): number =>
  SEVERITY[state.kind] * 10 +
  (state.kind === 'priced' && !state.edited ? 1 + REVIEW_SEVERITY.indexOf(state.review) : 0)

/** An assembly's state: its worst part's, and which part that is (null with no part). */
export interface AssemblyState {
  state: PartState
  partId: string | null
}

/**
 * The worst state among the parts made (the first of equals, in their order), naming its part; with
 * none made, among them all; with no part, gone.
 */
export const assemblyStateOf = (
  parts: ReadonlyArray<Pick<AssemblyMember, 'partId' | 'state' | 'count'>>,
): AssemblyState => {
  const made = madeOf(parts)
  const [first, ...rest] = made.length > 0 ? made : parts
  if (!first) {
    return { state: { kind: 'gone' }, partId: null }
  }
  const worst = rest.reduce(
    (found, part) => (severity(part.state) < severity(found.state) ? part : found),
    first,
  )
  return { state: worst.state, partId: worst.partId }
}

/**
 * Signed off: it has a part made, and every part made is (priced as it stands, in Quote, approved).
 * A part not made needs no plan.
 */
export const assemblySignedOff = (
  parts: ReadonlyArray<Pick<AssemblyMember, 'state' | 'count'>>,
): boolean => assemblyMade(parts) && madeOf(parts).every((part) => isSignedOff(part.state))

/**
 * Whether the assembly has a part made: marked and counted above 0. One with none can't move on
 * past Plan Part ({@link NO_PART_MADE}), be signed off, sent or ordered ({@link noPartMarked}).
 */
export const assemblyMade = (parts: ReadonlyArray<Pick<AssemblyMember, 'count'>>): boolean =>
  madeOf(parts).length > 0

/** Why an assembly with no part made can't move on: there is nothing to plan or price. */
export const NO_PART_MADE =
  'Every part of this assembly is unmarked or counted 0. Mark one, or give a marked part a count, first.'

/**
 * Why a quote can't be signed off, sent or ordered with an assembly on it that has no part made
 * (`assemblyMade`), naming it: nothing of it would be quoted.
 */
export const noPartMarked = (assemblyName: string): string =>
  `${assemblyName} has no part marked. Mark one, or set it to No quote.`

/** {@link moveFor}'s answer for an assembly; a refusal names the part refused, null for none. */
export type AssemblyMove =
  | Exclude<StageMove, { kind: 'refused' }>
  | { kind: 'refused'; reason: string; partId: string | null }

/**
 * What moving an assembly does, from each made part's {@link moveFor}: the first part refused
 * refuses it, named; else it is priced without times if any part needs that (the rest moving as
 * they are); else approved only if every part would be; else moved. Null where it is no move: in
 * the stage already, with nothing to approve. A part not made is not asked. With no part made, it
 * can only go back to Plan Part ({@link NO_PART_MADE}).
 */
export const moveForAssembly = (
  stage: PartStage,
  parts: ReadonlyArray<AssemblyMember>,
  to: PartStage,
): AssemblyMove | null => {
  const made = madeOf(parts)
  if (!assemblyMade(parts)) {
    if (stage === to) {
      return null
    }
    return to === 'setup'
      ? { kind: 'move' }
      : { kind: 'refused', reason: NO_PART_MADE, partId: null }
  }
  const moves = made.map((part) => ({
    partId: part.partId,
    move: moveFor({ stage, state: part.state, estimate: part.estimate }, to),
  }))
  for (const { partId, move } of moves) {
    if (move?.kind === 'refused') {
      return { ...move, partId }
    }
  }
  if (moves.some(({ move }) => move?.kind === 'withoutTimes')) {
    return { kind: 'withoutTimes' }
  }
  if (moves.every(({ move }) => move?.kind === 'approve')) {
    return { kind: 'approve' }
  }
  // In the stage already, a part with nothing to approve makes it no move at all.
  if (moves.some(({ move }) => move === null)) {
    return null
  }
  return { kind: 'move' }
}

/**
 * The approval taken back: what was approved is no longer what is offered — a part re-planned from
 * changed inputs, a part added or deleted (a part counted again from 0 is one added,
 * `countWithdrawsApproval`), a move out of Quote. Any other count edited is not: the price follows
 * it, approved. An assembly in Quote goes back to Estimate; one moved out of it keeps the stage it
 * was moved to.
 */
export const withdrawnApproval = ({
  stage,
}: Pick<AssemblyApproval, 'stage'>): AssemblyApproval => ({
  stage: stage === 'quote' ? 'estimate' : stage,
  approved: false,
})

/**
 * Whether a part's times landing take its assembly's approval back: any part's new plan does,
 * unless what landed is of the very inputs the approved estimate was priced from (`replaced`, its
 * baseline's fingerprint) and that estimate had a plan.
 */
export const landingWithdrawsApproval = ({
  approved,
  replaced,
  landed,
}: {
  approved: boolean
  /** The baseline the landing replaces; null with none. */
  replaced: { fingerprint: string | null; withoutPlan: boolean } | null
  /** The fingerprint of the inputs the landed times are of. */
  landed: string
}): boolean =>
  approved && (replaced === null || replaced.withoutPlan || replaced.fingerprint !== landed)

/* ---------- Quantity and pieces ---------- */

/**
 * How many of a part one assembly needs: by default its shape's body count in the file (one for a
 * part of a single body), as taken when the part was made, less the bodies of the shape used as
 * stock (`stockBodiesTaken`), which the shop may override (`countOverride`; null follows the
 * shape). 0 is a part not made, as is every part the shop has not marked (`unmarked`).
 */
export interface PartCount {
  /** The shape's body count in the file, as Toolpath gave it. */
  shapeCount: number
  /**
   * How many of the shape's bodies are stock for parts of the assembly (`stockBodiesTakenOf`): stock
   * only, never made, so they come off the default count.
   */
  stockBodiesTaken: number
  countOverride: number | null
  /**
   * Not marked a part by the shop: a body of its file, not quoted, counted 0 whatever the rest says
   * (`partMarked`). Its override is kept for when it is marked again.
   */
  unmarked: boolean
}

/**
 * Whether the shop has marked the part: a part to quote, rather than a body of its file. A part
 * not marked is not made (`partMade`); a part marked may still be counted 0.
 */
export const partMarked = (part: Pick<PartCount, 'unmarked'>): boolean => !part.unmarked

/** The count the shape gives the part: its bodies, less those used as stock, never below 0. */
export const shapeDefaultCount = ({
  shapeCount,
  stockBodiesTaken,
}: Pick<PartCount, 'shapeCount' | 'stockBodiesTaken'>): number =>
  Math.max(0, shapeCount - stockBodiesTaken)

/**
 * The part's count per assembly: the shop's, else its shape's (`shapeDefaultCount`); 0 for a part
 * not marked (`partMarked`).
 */
export const countPerAssembly = (part: PartCount): number =>
  partMarked(part) ? (part.countOverride ?? shapeDefaultCount(part)) : 0

/**
 * A part of an assembly as its stock bodies are counted: its shape, the body it is cut from, and
 * its own count (`countPerAssembly`), which says how many copies of that body it takes — none,
 * not marked.
 */
export interface StockTaker extends Pick<PartCount, 'shapeCount' | 'countOverride' | 'unmarked'> {
  partId: string
  /** Which of the file's shapes the part is; null for a part of no file. */
  shapeIndex: number | null
  /** The body of its file the part is cut from, or null for its stock policy. */
  stockBodyIndex: number | null
}

/**
 * Each part's `stockBodiesTaken`, by part id: how many of its shape's copies the assembly's parts
 * are cut from. A body stands for every copy the file places of it, so a part cut from a body of
 * the shape takes one copy per piece it makes: the shape's number taken is the sum of those parts'
 * counts, never more than the shape's own count (`shapeCount`). `shapeOf` says which shape a body
 * of the file is, null for none it lists.
 *
 * A cutter's count is its override, else its own shape's default, so the parts cut from a shape
 * are resolved before it, and a stock shape's count never feeds back into the parts cut from it.
 * A cutter not marked (`partMarked`) takes none.
 * A cycle (a part cut from another body of its own shape, or two shapes each cut from the other)
 * is cut where it closes: there the cutter's shape counts no copies taken.
 */
export const stockBodiesTakenOf = (
  parts: ReadonlyArray<StockTaker>,
  shapeOf: (bodyIndex: number) => number | null,
): Map<string, number> => {
  const cutters = new Map<number, Array<StockTaker>>()
  for (const part of parts) {
    const shape = part.stockBodyIndex === null ? null : shapeOf(part.stockBodyIndex)
    if (shape !== null) {
      cutters.set(shape, [...(cutters.get(shape) ?? []), part])
    }
  }
  const taken = new Map<number, number>()
  const resolving = new Set<number>()
  const takenOf = (shape: number | null): number => {
    if (shape === null || resolving.has(shape)) {
      return 0
    }
    const known = taken.get(shape)
    if (known !== undefined) {
      return known
    }
    resolving.add(shape)
    const needed = (cutters.get(shape) ?? []).reduce(
      (sum, cutter) =>
        sum +
        (partMarked(cutter)
          ? (cutter.countOverride ??
            shapeDefaultCount({
              shapeCount: cutter.shapeCount,
              stockBodiesTaken: takenOf(cutter.shapeIndex),
            }))
          : 0),
      0,
    )
    resolving.delete(shape)
    const own = parts.find((part) => part.shapeIndex === shape)
    const result = own ? Math.min(own.shapeCount, needed) : 0
    taken.set(shape, result)
    return result
  }
  return new Map(parts.map((part) => [part.partId, takenOf(part.shapeIndex)]))
}

/** Why a stock body can't be chosen where it would leave the assembly with no part made. */
export const STOCK_LEAVES_NONE_MADE =
  'Cutting this part from that body would leave no part of the assembly made. Choose another body.'

/** Whether the shop's count stands in place of the shape's: what a "file says ×N" hint reads. */
export const countOverridden = ({ countOverride }: PartCount): boolean => countOverride !== null

/**
 * The shop's count set: the shape's own count clears the override, so it follows the shape again.
 * Whether the part is marked is not the count's: a part not marked is refused a count
 * (`countRefusal`).
 */
export const withCount = (part: PartCount, count: number): Omit<PartCount, 'unmarked'> => ({
  shapeCount: part.shapeCount,
  stockBodiesTaken: part.stockBodiesTaken,
  countOverride: count === shapeDefaultCount(part) ? null : count,
})

/** Whether the part is made: counted above 0 in its assembly. */
export const partMade = (part: PartCount): boolean => countPerAssembly(part) > 0

/**
 * The most an assembly's quantity, or a part's count per assembly, may be: well under the integer
 * column either is stored in, and far above any real order.
 */
export const MAX_ASSEMBLY_COUNT = 1_000_000

/**
 * A count per assembly as typed or sent, or why not: a whole number, 0 or more, at most
 * {@link MAX_ASSEMBLY_COUNT}.
 */
export const parseCountPerAssembly = (value: unknown): number | string =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= MAX_ASSEMBLY_COUNT
    ? value
    : 'The count per assembly must be a whole number, 0 or more, at most 1,000,000.'

/** Why the last part made can't be counted 0: leaving the assembly out is No quote's. */
export const LAST_PART_MADE = 'Use No quote to leave out the whole assembly.'

/** Why a part not marked can't be counted: it is a body of its file, not quoted, until marked. */
export const UNMARKED_COUNTED =
  'This body is not marked as a part. Mark it first to give it a count.'

/**
 * Why a part's count can't be set, or null: any count of a part not marked ({@link
 * UNMARKED_COUNTED}), and 0 for the assembly's last part made ({@link LAST_PART_MADE}). `parts`
 * are every part of the assembly with its count as it stands, and whether it is marked.
 */
export const countRefusal = (
  parts: ReadonlyArray<Pick<AssemblyMember, 'partId' | 'count'> & Pick<PartCount, 'unmarked'>>,
  partId: string,
  count: number,
): string | null => {
  if (parts.some((part) => part.partId === partId && !partMarked(part))) {
    return UNMARKED_COUNTED
  }
  return count === 0 && !parts.some((part) => part.partId !== partId && part.count > 0)
    ? LAST_PART_MADE
    : null
}

/**
 * Whether a count edited takes the assembly's approval back: only a part counted again from 0,
 * which adds a part the approval never covered. A count moved between two above 0, or to 0, keeps
 * it: the approved price follows the count.
 */
export const countWithdrawsApproval = (from: number, to: number): boolean => from === 0 && to > 0

/** Why a part can't be deleted when only parts counted 0 would be left. */
export const LAST_MADE_DELETED = 'Mark another part, or set another marked part’s count, first.'

/**
 * Why a part can't be deleted, or null: refused ({@link LAST_MADE_DELETED}) where parts would be
 * left and none of them made. Deleting the assembly's last part is not refused: the assembly goes
 * with it. `parts` are every part of the assembly with its count as it stands.
 */
export const deleteRefusal = (
  parts: ReadonlyArray<Pick<AssemblyMember, 'partId' | 'count'>>,
  partId: string,
): string | null => {
  const left = parts.filter((part) => part.partId !== partId)
  return left.length > 0 && left.every((part) => part.count === 0) ? LAST_MADE_DELETED : null
}

/**
 * How many of a part are priced: its assembly's quantity, in assemblies, times its count per
 * assembly. A part alone, ×1, is priced at its assembly's quantity; a part not made, at none.
 */
export const piecesOf = (quantity: number, part: PartCount): number =>
  quantity * countPerAssembly(part)

/**
 * What `quoteStatus` counts of a revision, read by assembly: those on the quote — every one not
 * set to No quote — and how many of them are signed off (`assemblySignedOff`).
 */
export const quotedAssemblyCounts = (
  assemblies: Iterable<{
    noQuote: boolean
    parts: ReadonlyArray<Pick<AssemblyMember, 'state' | 'count'>>
  }>,
): Pick<Parameters<typeof quoteStatus>[0], 'assemblyCount' | 'estimatedAssemblyCount'> => {
  const quoted = [...assemblies].filter((assembly) => !assembly.noQuote)
  return {
    assemblyCount: quoted.length,
    estimatedAssemblyCount: quoted.filter((assembly) => assemblySignedOff(assembly.parts)).length,
  }
}
