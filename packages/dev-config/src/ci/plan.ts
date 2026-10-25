import type { ResolvedConfig, ResolvedSuite } from '../config/resolve.js'
import { toolchain } from '../policy/toolchain.js'
import { prerequisiteBuilds } from '../cli/build.js'
import { STANDARDS_STAGES, suiteReceiptId } from './result-policy.mjs'

type StandardsStage = (typeof STANDARDS_STAGES)[number]

/** A required browser or command suite the central workflow runs in its own bounded job. */
interface PlannedSuite {
  /** `project:suite`. */
  suite: string
  project: string
  runner: 'playwright' | 'command'
  /** Browsers the job installs before the suite; empty for command suites. */
  browsers: Array<'chromium' | 'firefox' | 'webkit'>
  /** The job's timeout: the suite's own bound plus setup headroom, never below the integration default. */
  timeoutMinutes: number
  /** Projects built first, once, in dependency order. */
  builds: Array<string>
  /** Environment variable names and executables the suite declares. */
  prerequisites: { env: Array<string>; commands: Array<string> }
  /** A filesystem- and artifact-safe key. */
  key: string
}

/** A required suite delegated to an explicit caller job (`ci.externalSuites`). */
export interface ExternalJob {
  suite: string
  project: string
  job: string
  runner: ResolvedSuite['runner']
  prerequisites: { env: Array<string>; commands: Array<string> }
}

interface ManualEntry {
  suite: string
  reason: string
}

/**
 * The deterministic CI execution plan for a repository: what the standards job
 * runs, which required suites get their own bounded jobs, which are delegated to
 * caller jobs, and which are manual (excluded before anything runs, visibly).
 */
export interface CiPlan {
  schemaVersion: 1
  node: string
  standards: {
    stages: Array<StandardsStage>
    /** Ordinary unit/component suites the `unit` stage runs. */
    unitSuites: Array<string>
    /** Prerequisite builds for type checks and unit suites, in dependency order. */
    builds: Array<string>
    timeoutMinutes: number
  }
  suites: Array<PlannedSuite>
  external: Array<ExternalJob>
  manual: Array<ManualEntry>
  /** Every receipt the central workflow requires, in run order. */
  receipts: Array<string>
}

/** The matrix row the reusable workflow's `suites` job expands. */
export interface SuiteMatrixEntry {
  suite: string
  key: string
  browsers: string
  timeout: number
}

const MAX_JOB_MINUTES = 120

const suiteKey = (suite: string): string => suite.replace(/[^a-z0-9._-]/gi, '-')

const integrationTimeout = (suite: ResolvedSuite): number => {
  const base =
    suite.runner === 'playwright'
      ? toolchain.ci.timeouts.browser
      : toolchain.ci.timeouts.integration
  return suite.timeoutMinutes === undefined
    ? base
    : Math.min(MAX_JOB_MINUTES, Math.max(base, suite.timeoutMinutes + 10))
}

export const createCiPlan = (resolved: ResolvedConfig): CiPlan => {
  const externalBySuite = new Map(
    resolved.externalSuites.map((entry) => [`${entry.project}:${entry.suite}`, entry]),
  )
  const unitSuites: Array<string> = []
  const suites: Array<PlannedSuite> = []
  const external: Array<ExternalJob> = []
  const manual: Array<ManualEntry> = []

  for (const project of resolved.projects) {
    for (const suite of project.suites) {
      if (suite.ordinary) {
        unitSuites.push(suite.id)
        continue
      }
      if (suite.ci === 'manual') {
        manual.push({ suite: suite.id, reason: suite.reason ?? '' })
        continue
      }
      const delegated = externalBySuite.get(suite.id)
      if (delegated) {
        external.push({
          suite: suite.id,
          project: project.name,
          job: delegated.job,
          runner: suite.runner,
          prerequisites: {
            env: [...suite.prerequisites.env],
            commands: [...suite.prerequisites.commands],
          },
        })
        continue
      }
      suites.push({
        suite: suite.id,
        project: project.name,
        runner: suite.runner === 'playwright' ? 'playwright' : 'command',
        browsers: suite.runner === 'playwright' ? [...suite.browsers] : [],
        timeoutMinutes: integrationTimeout(suite),
        builds: prerequisiteBuilds(resolved, [project]).map((dependency) => dependency.name),
        prerequisites: {
          env: [...suite.prerequisites.env],
          commands: [...suite.prerequisites.commands],
        },
        key: suiteKey(suite.id),
      })
    }
  }

  const stages = [...STANDARDS_STAGES]
  return {
    schemaVersion: 1,
    node: toolchain.runtime.node,
    standards: {
      stages,
      unitSuites,
      builds: prerequisiteBuilds(resolved, resolved.projects).map((project) => project.name),
      timeoutMinutes: toolchain.ci.timeouts.quality,
    },
    suites,
    external,
    manual,
    receipts: [...stages, ...suites.map((entry) => suiteReceiptId(entry.suite))],
  }
}

export const suiteMatrix = (plan: CiPlan): Array<SuiteMatrixEntry> =>
  plan.suites.map((entry) => ({
    suite: entry.suite,
    key: entry.key,
    browsers: entry.browsers.join(' '),
    timeout: entry.timeoutMinutes,
  }))
