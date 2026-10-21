import {
  statementOf,
  stockRequest,
  withFolders,
  type DraftSetup,
  type Statement,
  type StockOption,
  type ToolCrib,
} from '@toolpath/plan'

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
  stock: StockOption | null
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
}

/** A part's columns that are its plan's inputs; absent reads as none. */
export interface FingerprintPart {
  machiningStock?: StockOption | null
  materialId?: string | null
  machineProfileId?: string | null
  toolCrib?: ToolCrib | null
}

/** What a stored draft states, or null for nothing. */
export const draftStatement = (row: Pick<DraftRow, 'setups'>): Statement | null =>
  statementOf(withFolders(row.setups))

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
  stock: part.machiningStock ?? null,
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
 * crib is its library ids, in order. Two inputs that plan the same part give the same text.
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
      done: inputs.done && {
        kernelVersion: inputs.done.kernelVersion,
        regions: [...inputs.done.regions].sort((a, b) => a - b),
      },
      stock: inputs.stock,
      materialId: inputs.materialId,
      machineProfileId: inputs.machineProfileId,
      toolCrib: inputs.toolCrib.map((library) => library.id),
    }),
  )

/**
 * The part's stock as Toolpath is sent it with its draft (`stockRequest`): a fixed box, kept in the
 * part's axes, turned into the first folder's frame — or why it can't be; null for no stock.
 */
export const stockSent = (
  part: Pick<FingerprintPart, 'machiningStock'>,
  draft: Pick<DraftRow, 'setups'> | null,
): StockOption | string | null =>
  part.machiningStock
    ? stockRequest(part.machiningStock, draft?.setups[0]?.direction ?? null)
    : null
