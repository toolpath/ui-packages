import type { PlanDirection } from '@toolpath/plan'

import { stockRequest, type StockOption } from '../inputs/stock'
import type { PartStage } from '../model/part-stage'

/** Why Apply can't save the plan (`applyRefusal`). */
export type ApplyRefusal =
  /** The revision is closed: superseded, or paid for. */
  | 'locked'
  /** The part is past Plan Part: the plan is changed there only. */
  | 'not_in_plan'
  /** Saved from an older copy — a retry, another tab — it would write over what was saved since. */
  | 'stale'
  /** The stock can't be sent with these folders: the reason, about the stock. */
  | { refused: 'unsendable_stock'; message: string; field: 'stock' }

/** What `applyRefusal` reads, under the revision's hold. */
export interface ApplyFacts {
  /** The revision can be edited. */
  open: boolean
  stage: PartStage
  /** The version of the plan as saved; 0 before the first save. */
  savedVersion: number
  /** The version the save edits, as sent; anything but a number reads as 0. */
  version: unknown
  /** The stock as it will stand. */
  stock: StockOption | null
  /** The direction of the first setup saved; null with none. */
  first: PlanDirection | null
}

/**
 * Why Apply can't save the plan, or null when it can. Its plan is sent once applied, so a stock
 * that can't be sent with these folders — a fixed box with no first folder, or one facing off the
 * axes (`stockRequest`) — is refused here, not later at Toolpath.
 */
export const applyRefusal = (facts: ApplyFacts): ApplyRefusal | null => {
  if (!facts.open) {
    return 'locked'
  }
  if (facts.stage !== 'setup') {
    return 'not_in_plan'
  }
  if (facts.savedVersion !== (typeof facts.version === 'number' ? facts.version : 0)) {
    return 'stale'
  }
  const sendable = facts.stock && stockRequest(facts.stock, facts.first)
  return typeof sendable === 'string'
    ? { refused: 'unsendable_stock', message: sendable, field: 'stock' }
    : null
}
