import type { PartPipeline } from './part-state'

/*
  Whether what a stage needs — a plan, an estimate — is there for the part's inputs as they stand.
  Every artifact is stamped with the fingerprint of the inputs it was made from (`fingerprintOf`
  in `server/lib/plan-hash.ts`), as is every run; comparing those to the current fingerprint is the
  one rule here, read by the server's summaries and events and by the pages.
*/

export type ArtifactState = 'not-requested' | 'pending' | 'failed' | 'available'

/** How the part's last run stands: in flight, refused or lost, or landed. */
export type RunStatus = 'pending' | 'failed' | 'landed'

export interface ArtifactRun {
  /** The fingerprint of the inputs the run was asked for; null for one from before they were stamped. */
  fingerprint: string | null
  status: RunStatus
}

export interface ArtifactFacts {
  /** The fingerprint of the part's inputs as they stand. */
  current: string
  run: ArtifactRun | null
  /** The artifact as it is, with the fingerprint it was made from; null with none. */
  artifact: { fingerprint: string | null } | null
}

/**
 * Available when the artifact is for the current inputs; else pending or failed when the last run
 * was for them; else not requested — nothing has been asked of Toolpath for these inputs yet.
 */
export const artifactStateOf = ({ current, run, artifact }: ArtifactFacts): ArtifactState => {
  if (artifact?.fingerprint === current) {
    return 'available'
  }
  if (run?.fingerprint === current && run.status !== 'landed') {
    return run.status
  }
  return 'not-requested'
}

/** The run a part's pipeline says it is on. */
export const runStatusOf = (pipeline: PartPipeline): RunStatus => {
  switch (pipeline) {
    case 'analyzing':
    case 'sending':
    case 'planning':
      return 'pending'
    case 'analysis_failed':
    case 'plan_failed':
    case 'gone':
      return 'failed'
    case 'ready':
      return 'landed'
  }
}

/** What a part's stages need: Plan its plan, Estimate its estimate (times). */
export interface PartArtifacts {
  plan: ArtifactState
  estimate: ArtifactState
}

/**
 * The part's plan and estimate, from its estimate's baseline and the run on its way. The times
 * land with the baseline, so its fingerprint is the estimate's — and the plan's too, except a
 * baseline priced without a plan (`withoutPlan`), which is an estimate for its inputs but no plan
 * of them. The setups land before the times: a run for the current inputs that has `planned` them
 * is a plan available, its estimate still pending.
 */
export const partArtifactsOf = ({
  current,
  run,
  baseline,
  planned,
}: {
  current: string
  run: ArtifactRun | null
  baseline: { fingerprint: string | null; withoutPlan: boolean } | null
  /** The run on its way has landed its setups, their times still to come. */
  planned: boolean
}): PartArtifacts => ({
  plan:
    planned && run?.fingerprint === current && run.status === 'pending'
      ? 'available'
      : artifactStateOf({ current, run, artifact: baseline?.withoutPlan ? null : baseline }),
  estimate: artifactStateOf({ current, run, artifact: baseline }),
})
