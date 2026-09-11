/**
 * Whether a tool can cut a feature.
 *
 * ## The seam that lets this travel at all
 *
 * Reading a feature's demands off a Toolpath datasheet needs the Engine's part
 * schema. *Checking a tool against those demands* needs only tool vocabulary.
 * Those two halves sat in one file, and splitting them at {@link FeatureDemand}
 * is what lets the checking live here: every field of a demand is tool
 * language, and no part feature, machining direction or datasheet appears in
 * it.
 *
 * So the adapter — feature to demand — stays with whoever holds the report, and
 * this package inherits no OpenAPI contract for it. A consumer with no Toolpath
 * report at all can state a demand by hand and ask the same question.
 *
 * ## What is not stated is not claimed
 *
 * **A demand the datasheet does not state is not checked.** The alternative —
 * treating an absent measurement as zero, or as no limit — is the difference
 * between a shop trusting a tool list and a shop checking every row of it by
 * hand.
 *
 * This is the opposite of the rule `holderTakesTool` follows, and deliberately:
 * there, an unchecked case is a cutter falling out of a spindle, so silence
 * refuses. Here an unchecked case is a tool offered that a machinist will look
 * at anyway, so silence passes.
 */

import type { FeatureDemand } from './demand.js'
import type { ToolForm } from './forms.js'
import type { Tool } from './tool.js'

/**
 * The forms that go into a hole bore-first, and so are bounded by the bore
 * rather than by what can helix down it.
 *
 * Stated over {@link ToolForm} rather than over a coarser tool type, which is a
 * refinement: the coarse vocabulary this replaced had one word, `drill`, for
 * what a CAM library calls a drill, a centre drill and a spot drill, so a
 * stated spot drill could not be recognised as going in bore-first. All three
 * do.
 */
export const DRILLING_FORMS: ReadonlySet<ToolForm> = new Set<ToolForm>([
  'drill',
  'center drill',
  'spot drill',
  'reamer',
])

/** Why a tool cannot cut a feature, in the words a machinist would use. */
export interface FitFailure {
  readonly featureTag: string
  readonly reason: string
}

export interface ToolFit<T> {
  readonly tool: T
  readonly fits: boolean
  /** Empty when the tool fits. One entry per feature that ruled it out. */
  readonly failures: readonly FitFailure[]
}

/** Whether one tool can cut one feature, and why not where it cannot. */
export const fitAgainst = (
  tool: Pick<Tool, 'geometry' | 'form'>,
  demand: FeatureDemand,
): FitFailure[] => {
  const failures: FitFailure[] = []
  const say = (reason: string) => failures.push({ featureTag: demand.featureTag, reason })

  const diameter = tool.geometry.DC
  const fluteLength = tool.geometry.LCF
  const cornerRadius = tool.geometry.RE
  const drilling = DRILLING_FORMS.has(tool.form as ToolForm)

  // A hole states its own limits, and which one applies depends on how the tool
  // goes in: a drill is bounded by the bore, an endmill by what can helix in it.
  const widest = drilling
    ? (demand.maxDrillDiameter ?? demand.holeDiameter ?? demand.maxToolDiameter)
    : (demand.maxEndmillDiameter ?? demand.maxToolDiameter)

  if (diameter !== undefined && widest !== undefined && diameter > widest) {
    say(`⌀${diameter} mm is wider than the ${widest} mm this feature admits`)
  }

  if (fluteLength !== undefined && demand.depth !== undefined && fluteLength < demand.depth) {
    say(`${fluteLength} mm of flute does not reach ${demand.depth} mm deep`)
  }

  // A corner radius larger than the floor fillet leaves material the floor does
  // not have room for. A sharp tool in a filleted corner is fine — it just
  // leaves the fillet to something else.
  if (
    cornerRadius !== undefined &&
    demand.floorRadius !== undefined &&
    cornerRadius > demand.floorRadius
  ) {
    say(`a ${cornerRadius} mm corner does not fit a ${demand.floorRadius} mm floor fillet`)
  }

  return failures
}

/**
 * Which tools cut **every** demand given.
 *
 * The intersection is the point of the exercise: one setup wants one tool for
 * as much of the part as possible, and a tool that clears four of five features
 * is not an answer — but knowing which feature ruled it out is, which is why a
 * near miss keeps its failures instead of vanishing.
 *
 * With no demands every tool fits, because nothing has been asked of them yet.
 *
 * Generic in the tool, so a caller gets its own records back rather than a
 * projection of them.
 */
export const fitTools = <T extends Pick<Tool, 'geometry' | 'form'>>(
  tools: readonly T[],
  demands: readonly FeatureDemand[],
): ToolFit<T>[] =>
  tools.map((tool) => {
    const failures = demands.flatMap((demand) => fitAgainst(tool, demand))
    return { tool, fits: failures.length === 0, failures }
  })
