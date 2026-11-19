import {
  additionalDirectionsSent,
  customByFrame,
  type PlanDirection,
  statementOf,
  withGroups,
  type DraftSetup,
  type Statement,
} from '@toolpath/plan'

import { effectiveStock, stockRequest, type PlanStock, type SentStock } from '../inputs/stock'
import type { ToolCrib } from '../inputs/tool-crib'

/*
  What a part is planned from, and the one text that says it. Every run, plan and estimate is stamped
  with a fingerprint of these inputs: a hash of `fingerprintText`. The app hashes it (SHA-256 on the
  server); everything here only reads and compares the fingerprints.
*/

/** Done faces as Toolpath takes them: region indices, and the kernel that numbered them. */
export interface DoneRegions {
  kernelVersion: string
  regions: Array<number>
}

/**
 * The part-level inputs a plan is requested from: what the request to Toolpath carries that is the
 * part's own. Org-level settings — what a library holds, a machine's settings, workholding, the
 * fallback tools — are deliberately not among them: they are read as the request is built, and a
 * change to them does not read as a change to the part.
 */
export interface PlanInputs {
  /** The constraints: every frame stated, or null for none (Toolpath plans the part itself). */
  statement: Statement | null
  /** The faces ignored, with the kernel that numbered them; null for none. */
  done: DoneRegions | null
  /**
   * Each frame's own features, region lists with the analysis that numbered them, where any group
   * has one; null or absent for none. Only a plan spec carries them.
   */
  custom?: ReturnType<typeof customByFrame> | null
  /**
   * The directions Toolpath may add setups in, where a draft with a setup limits them
   * (`additionalDirectionsSent`); null or absent for any. Only a plan spec carries them.
   */
  additionalDirections?: Array<PlanDirection> | null
  /** The stock it is planned from (`effectiveStock`): a body of its file, or its policy. */
  stock: SentStock | null
  materialId: string | null
  machineProfileId: string | null
  toolCrib: ToolCrib
}

/** A stored draft's fields that say what it states, as the app's row keeps them. */
export interface DraftRow {
  setups: ReadonlyArray<DraftSetup>
  doneRegions: ReadonlyArray<number>
  doneKernelVersion: string | null
  kernelVersion: string | null
  /** Null or absent: Toolpath may add setups in any direction. */
  additionalDirections?: ReadonlyArray<PlanDirection> | null
}

/** A part's columns that are its plan's inputs; absent reads as none. */
export interface FingerprintPart {
  /** Its stock: a policy, or the body of its file it is cut from. */
  machiningStock?: PlanStock | null
  materialId?: string | null
  machineProfileId?: string | null
  toolCrib?: ToolCrib | null
}

/** What a stored draft states, or null for nothing. */
export const draftStatement = (row: Pick<DraftRow, 'setups'>): Statement | null =>
  statementOf(withGroups(row.setups))

/** A stored draft's own features by frame, or null for none. */
export const draftCustom = (row: Pick<DraftRow, 'setups'>): PlanInputs['custom'] => {
  const custom = customByFrame(withGroups(row.setups))
  return custom.length > 0 ? custom : null
}

/** The faces a stored draft has ignored, as Toolpath is told them, or null for none. */
export const draftDone = (row: Omit<DraftRow, 'setups'>): DoneRegions | null =>
  row.doneRegions.length > 0
    ? {
        // Marked before the kernel was recorded: the plan's own kernel is the best there is.
        kernelVersion: row.doneKernelVersion ?? row.kernelVersion ?? '',
        regions: [...row.doneRegions],
      }
    : null

/** A part's inputs as they stand: its row, and its draft — none for a part never edited. */
export const planInputsOf = (part: FingerprintPart, draft: DraftRow | null): PlanInputs => ({
  statement: draft ? draftStatement(draft) : null,
  done: draft ? draftDone(draft) : null,
  custom: draft ? draftCustom(draft) : null,
  additionalDirections: draft ? additionalDirectionsSent(draft) : null,
  stock: stockOf(part),
  materialId: part.materialId ?? null,
  machineProfileId: part.machineProfileId ?? null,
  toolCrib: part.toolCrib ?? [],
})

/** JSON with every object's keys in order, so the same inputs read the same however they were built. */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    )
  }
  return value
}

/**
 * The text a fingerprint hashes: the inputs as one JSON string, every key in order. The features
 * pinned in a setup are in any order, as are the faces done; names are never part of it; the tool
 * crib is its library ids, in order, an explicit entry marked as one. An explicit entry names a
 * version of a library, which never changes, so uploading a new version changes no part's text
 * until its crib names that version. Two inputs that plan the same part give the same text, and a
 * crib of implicit libraries alone reads as it did before explicit ones existed.
 */
export const fingerprintText = (inputs: PlanInputs): string =>
  JSON.stringify(
    canonical({
      statement:
        inputs.statement &&
        inputs.statement.setups.map((setup) =>
          setup.orientations.map(({ direction, features }) => ({
            direction,
            features: [...features].sort(),
          })),
        ),
      // Only where a draft has features of its own, so every other part's text is as it was.
      ...(inputs.custom ? { custom: inputs.custom } : {}),
      // Likewise only where Toolpath may not add setups everywhere.
      ...(inputs.additionalDirections ? { additionalDirections: inputs.additionalDirections } : {}),
      done: inputs.done && {
        kernelVersion: inputs.done.kernelVersion,
        regions: [...inputs.done.regions].sort((a, b) => a - b),
      },
      stock: inputs.stock,
      materialId: inputs.materialId,
      machineProfileId: inputs.machineProfileId,
      toolCrib: inputs.toolCrib.map((library) =>
        library.kind === 'explicit' ? { explicit: library.id } : library.id,
      ),
    }),
  )

/** The stock the part is planned from (`effectiveStock`): its stock body, or its policy. */
export const stockOf = (part: Pick<FingerprintPart, 'machiningStock'>): SentStock | null =>
  effectiveStock(part.machiningStock ?? null)

/**
 * The part's stock as Toolpath is sent it with its draft (`stockRequest`): a body of its file as it
 * is; a fixed box, kept in the part's axes, turned into the first group’s frame — or why it can't
 * be; null for no stock.
 */
export const stockSent = (
  part: Pick<FingerprintPart, 'machiningStock'>,
  draft: Pick<DraftRow, 'setups'> | null,
): SentStock | string | null => {
  const stock = stockOf(part)
  if (stock === null || stock.mode === 'body') {
    return stock
  }
  return stockRequest(stock, draft?.setups[0]?.direction ?? null)
}
