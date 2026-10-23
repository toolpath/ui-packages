import type { AutomaticStock, Constraints, StockOption, ToolCrib, Units } from '@toolpath/plan'

/*
  The quoting app's plan draft: plan mode's constraints (`@toolpath/plan`), and what the app keeps
  beside them on each part — the inputs held with them until Apply, and how the draft was saved.
  `applyDraftAction` from `@toolpath/plan` takes this draft and hands these fields back as they were.
*/

/**
 * The plan's inputs as held with the constraints: what the part is cut from, on, with and out of.
 * Held on the Plan page until Apply, as the constraints are; the part's row is where they are kept.
 */
export interface PartInputsHeld {
  materialId: string | null
  machineProfileId: string | null
  toolCrib: ToolCrib
  /** The machining stock asked for, and the automatic profile it was copied from, if any. */
  stock: { policy: StockOption | null; profileId: string | null }
  /**
   * The DFM rule sets the part is checked against, sorted; none follows the org's default sets.
   * Held and applied with the rest, but not planned from: it changes no fingerprint.
   */
  dfmRuleSetIds: Array<string>
}

/** Which of the part's inputs an Apply refused is about, so the page can open it. */
export type InputField = 'material' | 'machine' | 'toolCrib' | 'stock' | 'dfmRules'

export interface PlanDraft extends Constraints {
  /** The kernel whose tags the pins name; null until something is pinned. */
  kernelVersion: string | null
  /** When somebody last changed it; null before the first save. */
  editedAt: string | null
  /** How many times it has been saved: a save names the version it edits (0 before the first). */
  version: number
  /**
   * Changed since the part's times were planned: its setups are not the plan Toolpath last made.
   * Until the edits are applied, everything priced from those times is out of date.
   */
  changed: boolean
  /** The part's inputs as applied: its material, machine, tool crib and stock. */
  inputs: PartInputsHeld
}

/** What an edit changes, and undo puts back: the constraints, and the part's inputs as held. */
export type Intent = Constraints & Pick<PlanDraft, 'inputs'>

/** A part's saved machining policy and the metadata needed to edit and recalculate it. */
export interface StockState {
  policy: StockOption | null
  profileId: string | null
  version: number
}

/** A stock profile: automatic stock settings the shop saves under a name. */
export interface StockProfileInput {
  name: string
  units: Units
  settings: AutomaticStock
}
export interface StockProfileSummary extends StockProfileInput {
  id: string
  isDefault: boolean
}
