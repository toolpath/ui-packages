import { UsageError } from '../../errors.js'
import type { Output } from '../output.js'
import { verifyReactProjects } from '../react-gate.js'
import { loadWorkspace } from '../workspace.js'

/**
 * `react verify`: for each selected React project, the doctor-level adapter
 * checks and then a real transform of a probe component through the project's
 * own build configuration. `check` and the CI unit stage run the same step.
 */
export const reactVerify = async (
  flags: { config?: string; projects: Array<string> },
  output: Output,
): Promise<void> => {
  const workspace = await loadWorkspace(flags)
  if (!workspace.selected.some((project) => project.react)) {
    throw new UsageError('react verify: the selected projects declare no react profile.')
  }
  await verifyReactProjects(workspace.resolved, workspace.selected, output)
}
