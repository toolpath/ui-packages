/*
  Toolpath's plan for a part, as a Plan page reads it: an app parses the Engine's answer at its
  boundary, and the page shows it. Only what the page uses is kept.
*/

/** A feature type as a person says it: `open_pocket` → `Open pocket`. */
export const featureTypeLabel = (type: string): string => {
  const words = type.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A direction token, exactly as Toolpath served it: the kernel compares directions bit-exactly. */
export interface PlanDirection {
  x: number
  y: number
  z: number
}

/** One pass of a setup: its tool, and the features (tags, hex) it cuts. */
export interface EnginePlanAction {
  idx: number
  toolName: string
  featureTags: Array<string>
}

export interface EnginePlanSetup {
  idx: number
  /** The setup's first direction — a 3+2 setup has more, in {@link EnginePlan.setupPlan}. */
  direction: PlanDirection | null
  /** Features this setup was meant to machine that no pass in it does. */
  unmachined: Array<string>
  actions: Array<EnginePlanAction>
}

/** What a setup was meant to machine and no pass in it does — Engine's `unmachined` — by tag. */
export const notMachinedOf = (setup: Pick<EnginePlanSetup, 'unmachined'>): Array<string> =>
  setup.unmachined

/** One direction of a setup, and the features planned from it. */
export interface StatedOrientation {
  direction: PlanDirection
  features: Array<string>
}

/**
 * A plan's statement of itself — every setup in order, each with all of its directions and the
 * features planned from each. What Toolpath takes back to plan from a statement.
 */
export interface SetupPlan {
  setups: Array<{ orientations: Array<StatedOrientation> }>
}

/** What the plan leaves uncut: `Unseen`, `OutOfPlay` or `Incomplete`, with its area (mm²). */
export interface PlanIssue {
  kind: string
  area: number
  regionCount: number
}

export interface EnginePlan {
  planId: string
  /**
   * The job that made this run of the plan. Every run is a new plan now, but plans recalculated in
   * place before that share a plan id, so a run is told by plan and job together (`runKey`). Null
   * from a plan copy stored before it was read.
   */
  jobId: string | null
  /**
   * How far the plan has got: `planned`, its setups built but not timed yet, or `toolpathed`, with
   * its toolpaths and times. Null from a copy stored before Toolpath said.
   */
  level: 'planned' | 'toolpathed' | null
  kernelVersion: string | null
  issues: Array<PlanIssue>
  setups: Array<EnginePlanSetup>
  /** Null from an Engine that does not serve it (before API 1.19), or for a plan with no setup. */
  setupPlan: SetupPlan | null
}

/**
 * Which run of a plan this is: its id and the job that made it. What the Plan page stamps a taken-out
 * list or an added folder with, so both are let go once Toolpath has planned again. A plan read
 * without a job falls back to its id.
 */
export const planRunOf = (plan: Pick<EnginePlan, 'planId' | 'jobId'>): string =>
  plan.jobId ? `${plan.planId}/${plan.jobId}` : plan.planId
