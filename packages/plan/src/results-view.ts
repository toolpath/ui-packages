import type { EnginePlan } from './engine-plan'
import { framesOf, sameDirection, type Constraints } from './plan-draft'
import { planView, type PlanFeatureRow, type PlanPart, type PlannedSetupView } from './plan-view'

/*
  Toolpath's plan as the Results view lays it out: its setups in machining order, each named by the
  constraint folder it was planned from — matched by direction, since Toolpath keeps stated setups
  in their order but leaves out one with nothing to machine — with its rows, each with the tool that
  cuts it. No times: the plan says what is cut, and how long it takes is another answer.
*/

/** A row's red mark: nothing cuts it, or a pass roughs it but none finishes it (MP-22). */
export type UnmachinedMark = false | 'notMachined' | 'notFinished'

/** One feature a setup takes: what cuts it, and whether it is left short. */
export interface ResultsFeatureRow extends PlanFeatureRow {
  /** The tools whose passes cut it, each once; null where none does. */
  tool: string | null
  mark: UnmachinedMark
}

/** A setup of Toolpath's plan, as the Results tree lists it. */
export interface ResultsSetupView extends PlannedSetupView {
  /** Its place in the plan: `plan.setups[idx]`. */
  idx: number
  /** Each feature it takes once, in the order its orientations list them. */
  rows: Array<ResultsFeatureRow>
  /** The constraint frame it was planned from — one facing a way it is cut from — or null for one Toolpath added. */
  fromFolder: string | null
}

export interface ResultsView {
  setups: Array<ResultsSetupView>
  /** Constraint frames no setup was planned from: nothing to machine from there, so left out. */
  leftOut: Array<{ folderId: string; name: string }>
}

const EMPTY: ResultsView = { setups: [], leftOut: [] }

/**
 * Toolpath's plan laid out for the Results view. A setup takes the name of the first constraint
 * frame facing a direction it is cut from — a tilt's, with its setup's (`Setup 1 › Tilt`) — else
 * `Setup N`; the frames no setup faces are `leftOut`. The frames are the constraints the plan is
 * of, as applied: with none (edits held, or the plan of an earlier version) nothing is named and
 * nothing is left out.
 */
export const resultsView = ({
  plan,
  constraints,
  part,
}: {
  plan: EnginePlan | null
  /** The applied constraints the plan is of; null where it is not of the constraints as applied. */
  constraints: Pick<Constraints, 'setups'> | null
  part: PlanPart
}): ResultsView => {
  if (!plan) {
    return EMPTY
  }
  const frames = framesOf(constraints?.setups ?? [])
  const nameOf = (frame: (typeof frames)[number]): string => {
    const hold = frame.id === frame.holdId ? null : frames.find((each) => each.id === frame.holdId)
    return hold ? `${hold.name} › ${frame.name}` : frame.name
  }
  const matched = new Set<string>()
  const setups = planView(plan, part).map((view, idx): ResultsSetupView => {
    const setup = plan.setups[idx]!
    // Every frame facing a way the setup is cut from: a stated 3+2 setup comes back as one setup
    // with its tilts among its orientations, so its tilt frames are matched here too.
    const facing = view.orientations.flatMap((orientation) => {
      const frame = frames.find((each) => sameDirection(each.direction, orientation.direction))
      return frame ? [frame] : []
    })
    for (const frame of facing) {
      matched.add(frame.id)
    }
    const frame = facing[0]
    const notFinished = new Set(view.notFinished.map((tag) => tag.toLowerCase()))
    const notMachined = new Set(view.notMachined.map((row) => row.tag.toLowerCase()))
    const row = (feature: PlanFeatureRow): ResultsFeatureRow => {
      const key = feature.tag.toLowerCase()
      const cuts = (action: { featureTags?: ReadonlyArray<string> | null }) =>
        (action.featureTags ?? []).some((tag) => tag.toLowerCase() === key)
      const tools = [...new Set(setup.actions.filter(cuts).map((action) => action.toolName))]
      return {
        ...feature,
        tool: tools.length > 0 ? tools.join(', ') : null,
        mark: notFinished.has(key) ? 'notFinished' : notMachined.has(key) ? 'notMachined' : false,
      }
    }
    // Each feature once: a tag two orientations list is the first's row.
    const listedKeys = new Set<string>()
    const listed = view.orientations
      .flatMap((orientation) => orientation.features)
      .filter((feature) => {
        const key = feature.tag.toLowerCase()
        return listedKeys.has(key) ? false : listedKeys.add(key)
      })
    // What the setup was meant to machine and no pass cuts, where it is not a row already.
    const unlisted = view.notMachined.filter((each) => !listedKeys.has(each.tag.toLowerCase()))
    return {
      ...view,
      idx,
      name: frame ? nameOf(frame) : view.name,
      rows: [...listed, ...unlisted].map(row),
      fromFolder: frame?.id ?? null,
    }
  })
  return {
    setups,
    leftOut: frames
      .filter((frame) => !matched.has(frame.id))
      .map((frame) => ({ folderId: frame.id, name: nameOf(frame) })),
  }
}

/** The setup a feature is machined in, by tag in any case: the first listing it, or null. */
export const setupOf = (
  setups: ReadonlyArray<ResultsSetupView>,
  tag: string,
): ResultsSetupView | null => {
  const key = tag.toLowerCase()
  return (
    setups.find((setup) =>
      setup.rows.some((row) => row.tag.toLowerCase() === key && row.mark !== 'notMachined'),
    ) ?? null
  )
}
