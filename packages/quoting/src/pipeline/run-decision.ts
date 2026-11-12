import { partArtifactsOf, runStatusOf } from '../model/artifact-state'
import type { PartPipeline } from '../model/part-state'

/*
  Whether to send a part to Toolpath, and whether what the page shows is of its inputs. A plan
  request is billed, so the rules here are the ones that keep a part to one run per set of inputs:
  nothing while one is on its way or its plan is of them already, and a failed run of the same
  inputs sent again only when a person asks. Every input is a fingerprint the app has made
  (`fingerprintText`, hashed), or a column it keeps.
*/

/** A baseline's stamp: the fingerprint its times were planned from, and whether no plan priced it. */
export interface BaselineFacts {
  /** Null for a baseline from before they were stamped. */
  fingerprint: string | null
  /** Priced without a plan: an estimate of its inputs, but no plan of them. */
  withoutPlan: boolean
}

/** The fingerprint a stored baseline was made from, or null for one from before they were stamped. */
export const baselineFingerprint = (
  baseline: Record<string, unknown> | null | undefined,
): string | null => (typeof baseline?.fingerprint === 'string' ? baseline.fingerprint : null)

/** A stored baseline's stamp, as its artifacts are read from it; null for no baseline. */
export const baselineFacts = (
  baseline: Record<string, unknown> | null | undefined,
): BaselineFacts | null =>
  baseline
    ? { fingerprint: baselineFingerprint(baseline), withoutPlan: baseline.withoutPlan === true }
    : null

/** The pipeline states in which Toolpath has the part: a job, or a send, on its way. */
export type WaitingPipeline = 'inspecting' | 'analyzing' | 'planning' | 'sending'

const WAITING: ReadonlySet<PartPipeline> = new Set<WaitingPipeline>([
  'inspecting',
  'analyzing',
  'planning',
  'sending',
])

/**
 * Whether Toolpath has the part — inspecting its file, analyzing it, or planning it, or a request on
 * its way there — so what the plan is made from cannot change under it. The one rule for a write's
 * `busy`.
 */
export const toolpathHas = (pipeline: PartPipeline): pipeline is WaitingPipeline =>
  WAITING.has(pipeline)

/**
 * Whether Toolpath has planned the part's setups under the job it waits on, their times still to
 * come. A hint for the page, which shows them; never where the part's times came from. A row read
 * without either column has planned nothing.
 */
export const hasPlanned = (part: {
  plannedJobId?: string | null
  pipelineJobId?: string | null
}): boolean => typeof part.plannedJobId === 'string' && part.plannedJobId === part.pipelineJobId

/** Whether the part is waiting on Toolpath — its pipeline or a directions analysis — and so worth asking about. */
export const isWaitingPart = (part: {
  pipeline: PartPipeline
  pipelineJobId: string | null
  directionsJobId: string | null
}): boolean =>
  (WAITING.has(part.pipeline) && part.pipelineJobId !== null) || part.directionsJobId !== null

/**
 * Whether the part's inputs (`current`, their fingerprint) are not what its times were planned
 * from. Times priced without a plan (`withoutPlan`) were planned from nothing, whatever they are
 * stamped with.
 */
export const timesChangedFrom = (current: string, baseline: BaselineFacts | null): boolean =>
  (baseline?.withoutPlan ?? false) || current !== (baseline?.fingerprint ?? null)

/**
 * Whether the plan the page shows is not of the part's inputs (`current`) — the draft's `changed`.
 * Once the run on its way has planned its setups (`planned`, `hasPlanned`) the page shows that
 * plan, which is of the inputs the run was asked for, whatever the times are of; until then it
 * shows the plan the times came from.
 */
export const changedFrom = (
  current: string,
  part: { runFingerprint: string | null; planned: boolean },
  baseline: BaselineFacts | null,
): boolean => (part.planned ? part.runFingerprint !== current : timesChangedFrom(current, baseline))

/** What a part's inputs need of Toolpath (`runDecision`). */
export type RunDecision =
  /** Nothing: its plan is of them already. */
  | 'available'
  /** Nothing: a run is on its way, and asks again for the newest inputs once it ends. */
  | 'pending'
  /**
   * Nothing: the last run, of these same inputs, failed — or the part's file could not be made a
   * part — sent again only when a person asks. Never the answer when `tryAgain` is true.
   */
  | 'wait'
  /**
   * Make the part's file parts again: Toolpath could not read it, or its bodies could not be made
   * parts. Inspecting a file is not billed; the parts' analyses and plans that follow are.
   */
  | 'reinspect'
  /** Read the model again, with its plan: Toolpath could not read it. Billed. */
  | 'reanalyze'
  /**
   * Nothing: the part is counted 0 in its assembly, so it is not made, and nothing is sent for it
   * while it stays so — asked or not.
   */
  | 'unmade'
  /**
   * Read the model only, to measure it, planning nothing: a part counted 0 whose size a part made
   * is priced from (`sizeNeeded`), asked for by a person. Billed.
   */
  | 'measure'
  /** A new plan from the inputs as they stand. Billed. */
  | 'start'

/** What `runDecision` reads: the part's inputs, its last run and its baseline. */
export interface RunFacts {
  /** The fingerprint of the part's inputs as they stand. */
  current: string
  pipeline: PartPipeline
  /** The fingerprint the last run was asked for; null for one from before runs were stamped. */
  runFingerprint: string | null
  baseline: BaselineFacts | null
  /** The run on its way has planned its setups (`hasPlanned`). */
  planned: boolean
  /** A person asked: Try again, or Request plan. Else a save, or a run that ended, is asking. */
  tryAgain: boolean
  /** Counted above 0 in its assembly (`partMade`); a part not made is sent nothing. */
  made: boolean
  /**
   * Counted 0, but a part made is cut from a body of its shape, and its material is priced from this
   * part's size, which it does not have yet: its model is read to measure it, and nothing is
   * planned. Absent is false.
   */
  sizeNeeded?: boolean
}

/**
 * The run the part's inputs need, if any: nothing when its plan is already of them (one priced
 * without a plan has an estimate of them but no plan, and gets one), or a run is in flight. A run
 * of these same inputs that failed waits for a person to ask again: a save that left them as they
 * were sends nothing. Asked again, a file that could not be made parts is tried again from its
 * bodies; a model Toolpath could not read is read again with its plan; any other failed run is
 * planned afresh, never onto the plan that failed. A file not made parts yet has no inputs Toolpath
 * could plan, so only a person asks for it again. A part counted 0 in its assembly is sent nothing,
 * unless a part made is priced from its size and it has none yet (`sizeNeeded`): then a person
 * asking has its model read, to measure it, and a save sends nothing.
 */
export const runDecision = (facts: RunFacts): RunDecision => {
  if (!facts.made) {
    if (!facts.sizeNeeded) {
      return 'unmade'
    }
    if (toolpathHas(facts.pipeline)) {
      return 'pending'
    }
    return facts.tryAgain ? 'measure' : 'wait'
  }
  if (facts.pipeline === 'inspection_failed') {
    return facts.tryAgain ? 'reinspect' : 'wait'
  }
  const status = runStatusOf(facts.pipeline)
  if (!facts.tryAgain && status === 'failed' && facts.runFingerprint === facts.current) {
    return 'wait'
  }
  const { plan } = partArtifactsOf({
    current: facts.current,
    run: { fingerprint: facts.runFingerprint, status },
    baseline: facts.baseline,
    planned: facts.planned,
  })
  if (plan === 'available') {
    return 'available'
  }
  if (toolpathHas(facts.pipeline)) {
    return 'pending'
  }
  return facts.pipeline === 'analysis_failed' ? 'reanalyze' : 'start'
}
