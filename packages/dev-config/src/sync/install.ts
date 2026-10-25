import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageManagerName } from '../config/packages.js'
import { PrerequisiteError } from '../errors.js'
import { run } from '../cli/process.js'

/**
 * Installs exact dev dependencies with the repository's own package manager, so
 * the manifest and lockfile stay consistent. A workspace root needs pnpm's
 * explicit `--workspace-root`.
 */
export const installExact = async (
  root: string,
  packageManager: PackageManagerName,
  specs: Readonly<Record<string, string>>,
): Promise<void> => {
  const list = Object.entries(specs).map(([name, version]) => `${name}@${version}`)
  if (list.length === 0) {
    return
  }
  const args =
    packageManager === 'pnpm'
      ? [
          'add',
          '--save-dev',
          '--save-exact',
          ...(existsSync(join(root, 'pnpm-workspace.yaml')) ? ['--workspace-root'] : []),
          ...list,
        ]
      : ['install', '--save-dev', '--save-exact', '--no-audit', '--no-fund', ...list]
  let result
  try {
    result = await run(packageManager, args, { cwd: root })
  } catch (error) {
    throw new PrerequisiteError(
      `Could not run ${packageManager}: ${(error as Error).message}. Is it installed and on PATH?`,
    )
  }
  if (result.code !== 0) {
    throw new PrerequisiteError(
      `${packageManager} ${args.join(' ')} failed:\n${`${result.stdout}${result.stderr}`.trim().split('\n').slice(-30).join('\n')}`,
    )
  }
}
