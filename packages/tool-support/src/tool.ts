/**
 * What every cutting tool states, solid or insert, read one way.
 *
 * The record itself is `model.ts`'s, and its shaft is `stack.ts`'s to read.
 * This is the arithmetic that holding, stickout and clearance share, so each
 * reads a face mill's body the way it reads a solid tool's head rather than
 * keeping a branch of its own.
 */

import type { CuttingTool, Tool } from './model.js'
import { optional } from './optional.js'

/**
 * How a tap makes its thread: by cutting it away, or by displacing material
 * into it.
 *
 * The record says it with its kind, `CuttingTap` or `FormingTap`. This is the
 * vocabulary `tool-scraper` validates a family's declared method against, kept
 * so it does not redeclare the two strings.
 */
export type ThreadMethod = 'cutting' | 'forming'

/** The methods, in the order a control offers them. Cutting leads because it is what most of a catalog is. */
export const THREAD_METHODS = ['cutting', 'forming'] as const satisfies readonly ThreadMethod[]

export const isThreadMethod = (value: string): value is ThreadMethod =>
  THREAD_METHODS.some((method) => method === value)

/** The figures a solid and an insert tool both state, under the solid tool's names. */
export type ToolDimensions = Pick<
  Tool,
  'diameter' | 'fluteLength' | 'shankClampMin' | 'cornerRadius'
>

/**
 * A tool's figures, read alike: a solid tool's own, and an insert tool's body
 * with its inserts' corner as the corner. What stands above the flutes is
 * either's `shaft`, which `stack.ts` reads.
 */
export const dimensionsOf = (tool: CuttingTool): ToolDimensions =>
  tool.type === 'solid'
    ? tool
    : {
        diameter: tool.body.diameter,
        fluteLength: tool.body.fluteLength,
        ...optional('cornerRadius', tool.insert.cornerRadius),
      }
