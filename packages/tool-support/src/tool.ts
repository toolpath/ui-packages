/**
 * A cutting tool, as everything downstream of a scrape needs one.
 *
 * ## Deliberately not a catalog's record
 *
 * A catalog's tool carries identity and commerce — a guid, a brand, a catalog
 * number, a product link, which material groups a vendor rates it for. None of
 * that is arithmetic: nothing that draws a tool, fits it to a feature or works
 * out how far it stands out of a holder reads a single one of those fields.
 *
 * So this is the *domain* shape and a catalog's record **extends** it, rather
 * than this being a projection of a record. That direction matters: a record
 * simply _is_ a {@link Tool}, with no adapter, which is what lets one number be
 * computed once and drawn, printed and checked against the same value.
 *
 * `geometry` keeps the scraper's own field names — `DC`, `SFDM`, `OAL`, `LCF`,
 * `RE`, `SIG`, `NOF`, `shoulder-diameter`, `shoulder-length`. See
 * `geometry.ts` for why they are not renamed here.
 *
 * All lengths are in millimetres and all angles in degrees. `UnitSystem` is a
 * fact about the vendor's sheet and is not carried here: it decides how a
 * number is rounded and shown rather than what it is, and the arithmetic that
 * needs it takes it as its own argument.
 */

import type { Geometry } from './geometry.js'
import type { ProvenanceMap } from './provenance.js'

/**
 * A hair, because a shoulder and a shank that are the same nominal size are the
 * same float only until one of them has been through a unit conversion: 3/8" is
 * 9.525 on the collet's sheet and 9.524999999999999 on the tool's.
 */
const EPSILON = 1e-6

/**
 * How a tap makes its thread: by cutting it away, or by displacing material
 * into it.
 *
 * **A second axis beside {@link Tool.form}, not two more forms.**
 * `forms.ts`'s vocabulary is Fusion's own, so that a tool exported there lands
 * on the type it already has, and Fusion has no form-tap type — a form tap is a
 * `tap right hand` there like any other. Adding `form tap right hand` would buy
 * a filter chip and cost that guarantee. It is the same call
 * `tool-scraper`'s `families/kennametal.ts` makes for keeping a holder's
 * `contact` off its `taper`: two facts about one part are two fields.
 *
 * The two are genuinely different tools. A former needs a larger hole, evacuates
 * no chip, and runs at its own feed; a cut tap does none of that. Nothing here
 * branches on it yet — a tap goes in on the hole's axis either way, and
 * `tool-drawing` has no publishable shape for either one's lead — but a
 * consumer choosing or feeding a tool cannot ask the question at all until the
 * fact is carried.
 */
export type ThreadMethod = 'cutting' | 'forming'

/**
 * The methods, in the order a control offers them.
 *
 * A list beside the union for the reason `PROVENANCE` is one: `tool-scraper`
 * validates a family's declared value against it rather than redeclaring the
 * two strings, and a filter panel offers it. Cutting leads because it is what
 * most of a catalog is.
 */
export const THREAD_METHODS = ['cutting', 'forming'] as const satisfies readonly ThreadMethod[]

export const isThreadMethod = (value: string): value is ThreadMethod =>
  THREAD_METHODS.some((method) => method === value)

export interface Tool {
  /** The CAM-library name for what the tool is: `flat end mill`, `drill`, `slot mill`. */
  readonly form: string
  /** What a machinist calls this one tool — a catalog number, usually. */
  readonly label?: string
  /**
   * How this tap makes its thread, where it is a tap and somebody has said.
   *
   * Optional, and **absent is nobody having said** rather than a claim of
   * cutting — the rule `holding.ts`'s `Clamping` keeps on a holder and `shankOf` keeps
   * on a shank. A non-tap carries none, because the question does not apply.
   */
  readonly threadMethod?: ThreadMethod
  readonly geometry: Geometry
  readonly provenance?: ProvenanceMap
}

/**
 * Whether the section between the flutes and the shank is a neck: a stated
 * shoulder past the flutes, narrower than the shank.
 *
 * A collet cannot close on a neck, so the tool stands out to its shoulder at
 * least, and a sweep meets the wall with the neck at its own radius. A shoulder
 * as wide as the shank is still a relief worth drawing, but it is plain shank.
 *
 * **This had a twin, and the twin is why this package exists.** One copy drew
 * the picture and the other decided the verdict, and the note beside the second
 * said it outright: *"If the rule ever changes, it changes in both places or the
 * picture and the verdict disagree about the same tool."* Nothing was watching
 * that. Now there is one rule, and a drawing and a clearance check cannot read a
 * different tool out of the same numbers.
 *
 * Takes the geometry structurally rather than a whole {@link Tool}, so a
 * catalog record with a narrower `Record<string, number>` satisfies it with no
 * adapter.
 */
export const hasNeck = (tool: { readonly geometry: Geometry }): boolean => {
  const { LCF, SFDM, DC } = tool.geometry
  const shoulder = tool.geometry['shoulder-length']
  const relief = tool.geometry['shoulder-diameter']
  if (shoulder === undefined || relief === undefined || LCF === undefined || shoulder <= LCF) {
    return false
  }
  const shank = SFDM ?? DC
  return shank === undefined ? true : relief < shank - EPSILON
}

/** Whether the shank behind the flutes is reduced, or the full cutting diameter. */
export type Shank = 'reduced' | 'full'

/**
 * Whether the shank behind the flutes is reduced.
 *
 * A **real relief**: a section immediately above the flutes that is a smaller
 * diameter than the flute diameter *and has a length*. The distinction matters
 * because vendors state a shoulder two different ways — 74 end mills in the
 * scraped corpus have a genuine reduced shank, while 171 state a shoulder
 * narrower than the cut whose shoulder length equals the flute length, which is
 * no section to draw or to sweep. The second kind is not called reduced.
 *
 * `null` where no shoulder is stated at all, which is not a claim that the
 * shank is full: it is nobody having said.
 *
 * Distinct from {@link hasNeck}, and both are needed. `hasNeck` asks whether
 * there is a narrower section to draw and sweep *below the shank*; this asks
 * whether the shank itself is reduced against the *cut*. A tool can have a
 * relief wider than its cutting diameter — 860 end mills do, 245 of them under
 * the cut — which is a neck to draw and not a reduced shank.
 */
export const shankOf = (tool: { readonly geometry: Geometry }): Shank | null => {
  const { DC, LCF } = tool.geometry
  const shoulder = tool.geometry['shoulder-diameter']
  const length = tool.geometry['shoulder-length']
  if (DC === undefined || shoulder === undefined) {
    return null
  }
  const narrower = shoulder < DC - EPSILON
  const real = length !== undefined && LCF !== undefined && length > LCF + EPSILON
  return narrower && real ? 'reduced' : 'full'
}
