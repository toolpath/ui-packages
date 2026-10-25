import { join } from 'node:path'
import type { Issue } from '../errors.js'
import { readManifest } from './resolve.js'
import type { ProjectConfig } from './types.js'

/**
 * The `node` and `library` presets check with NodeNext and `verbatimModuleSyntax`,
 * so a `.ts` file in a CommonJS package (no `"type": "module"`) cannot use
 * `export`, and neither can the tooling program's `*.config.ts`. Bundler-resolved
 * projects (`dom`, `native`) do not depend on the package type.
 */
export const moduleTypeIssues = (
  root: string,
  projects: ReadonlyArray<Pick<ProjectConfig, 'name' | 'root' | 'runtime' | 'kind'>>,
): Array<Issue> => {
  const issues: Array<Issue> = []
  const check = (directory: string, label: string): void => {
    const manifest = readManifest(directory) as ({ type?: string } & object) | undefined
    if (manifest && manifest.type !== 'module') {
      issues.push({
        path: `${label}package.json "type"`,
        message: `is ${manifest.type === undefined ? 'unset (CommonJS)' : `"${manifest.type}"`}. The standard checks TypeScript with NodeNext and verbatimModuleSyntax, which needs an ES module package: run \`npm pkg set type=module\` (after renaming CommonJS .js files to .cjs)`,
      })
    }
  }
  check(root, '')
  for (const project of projects) {
    const nodeNext =
      project.runtime === 'node' || (project.runtime === 'universal' && project.kind === 'library')
    if (nodeNext && project.root !== '.') {
      check(join(root, project.root), `${project.root}/`)
    }
  }
  return issues
}
