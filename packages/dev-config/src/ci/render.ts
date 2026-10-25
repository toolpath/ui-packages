// Placeholder until the shared-CI branch merges; it defines the real renderer.
import type { ResolvedConfig } from '../config/resolve.js'
import type { Issue } from '../errors.js'
import type { ReleaseIdentity } from '../release/metadata.js'

export const CALLER_WORKFLOW_PATH = '.github/workflows/quality.yml'
export const renderCallerWorkflow = (resolved: ResolvedConfig, identity: ReleaseIdentity): string =>
  `name: Quality\n# ${identity.workflow} ${String(resolved.projects.length)}\n`
export const callerWorkflowIssues = (
  text: string,
  resolved: ResolvedConfig,
  identity: ReleaseIdentity,
): Array<Issue> =>
  text === renderCallerWorkflow(resolved, identity)
    ? []
    : [{ path: CALLER_WORKFLOW_PATH, message: 'differs' }]
