// Placeholder until the React branch merges; it defines the real checks.
import type { ResolvedConfig } from '../config/resolve.js'
import type { Issue } from '../errors.js'

export const reactAdapterIssues = (resolved: ResolvedConfig): Array<Issue> =>
  resolved.projects.length < 0 ? [{ path: '', message: '' }] : []
