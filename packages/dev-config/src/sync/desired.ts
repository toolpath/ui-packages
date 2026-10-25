import { agentFileAssets, agentsBlock, AGENTS_BLOCK_ID, AGENTS_FILE } from '../agents/catalog.js'
import { CALLER_WORKFLOW_PATH, renderCallerWorkflow } from '../ci/render.js'
import type { PackageManagerName } from '../config/packages.js'
import type { ResolvedConfig } from '../config/resolve.js'
import { toolchain } from '../policy/toolchain.js'
import type { ReleaseIdentity } from '../release/metadata.js'
import { ESLINT_CONFIG, MANAGED_SCRIPTS, PRETTIER_CONFIG, preCommitBlock } from './templates.js'

export const HUSKY_PRE_COMMIT = '.husky/pre-commit'
export const PRE_COMMIT_BLOCK_ID = 'pre-commit'

type ManagedItem =
  | { kind: 'file'; path: string; content: string; mode?: number }
  | { kind: 'block'; path: string; id: string; content: string }

export interface DesiredState {
  managed: Array<ManagedItem>
  scripts: Record<string, string>
  /** Exact versions every managed tool must be declared and installed at. */
  devDependencies: Record<string, string>
}

export type DesiredScope = 'all' | 'agents'

const profile = (name: string): Record<string, string> => {
  const entries = toolchain.profiles[name] ?? {}
  return Object.fromEntries(
    Object.entries(entries).map(([pkg, version]) => [
      pkg,
      Array.isArray(version) ? (version[0] ?? '') : version,
    ]),
  )
}

/**
 * The exact tool versions this configuration's selected profiles need. TypeScript
 * and the Engine SDK keep the repository's current version when it is one of the
 * tested ones; every other tool has one exact version per release.
 */
export const profileDependencies = (
  resolved: Pick<ResolvedConfig, 'projects' | 'engine'>,
  current: Readonly<Record<string, string>>,
  ownVersion: string,
): Record<string, string> => {
  const tested = (name: string, versions: ReadonlyArray<string>, fallback: string): string => {
    const declared = current[name]
    return declared !== undefined && versions.includes(declared) ? declared : fallback
  }
  const dependencies: Record<string, string> = {
    '@toolpath/dev-config': ownVersion,
    eslint: toolchain.core.eslint,
    typescript: tested('typescript', toolchain.core.typescript, toolchain.core.defaultTypescript),
    // The tooling program and Node projects check against Node's types.
    ...profile('tooling'),
  }
  const projects = resolved.projects
  const runners = new Set(
    projects.flatMap((project) => project.suites.map((suite) => suite.runner)),
  )
  if (runners.has('vitest')) {
    Object.assign(dependencies, profile('vitest'))
  }
  if (
    projects.some(
      (project) =>
        project.runtime === 'dom' && project.suites.some((suite) => suite.runner === 'vitest'),
    )
  ) {
    Object.assign(dependencies, profile('dom'))
  }
  if (runners.has('playwright')) {
    Object.assign(dependencies, profile('playwright'))
  }
  if (runners.has('jest-expo')) {
    Object.assign(dependencies, profile('jest-expo'))
  }
  for (const project of projects) {
    if (!project.react) {
      continue
    }
    Object.assign(dependencies, profile('react'), profile(`react-${project.react.adapter}`))
  }
  if (resolved.engine) {
    const sdk = toolchain.profiles.engine?.['@toolpath/api']
    const versions = Array.isArray(sdk) ? sdk : sdk === undefined ? [] : [sdk]
    dependencies['@toolpath/api'] = tested(
      '@toolpath/api',
      versions,
      toolchain.engine.contracts[resolved.engine.contract]?.sdk ?? versions[0] ?? '',
    )
  }
  return dependencies
}

export interface DesiredOptions {
  resolved: ResolvedConfig
  packageManager: PackageManagerName
  identity: ReleaseIdentity
  /** Current declared versions (devDependencies merged over dependencies). */
  declared: Readonly<Record<string, string>>
  /** Path from the Git root to the configuration root (`''` when they coincide). */
  gitPrefix: string
  scope?: DesiredScope
}

/** Every managed file, block, script and tool version for a configuration and release. */
export const desiredState = ({
  resolved,
  packageManager,
  identity,
  declared,
  gitPrefix,
  scope = 'all',
}: DesiredOptions): DesiredState => {
  const selection = {
    engine: resolved.engine !== undefined,
    skillsDir: resolved.skillsDir,
    packageManager,
  }
  const agents: Array<ManagedItem> = [
    { kind: 'block', path: AGENTS_FILE, id: AGENTS_BLOCK_ID, content: agentsBlock(selection) },
    ...agentFileAssets(selection).map((asset): ManagedItem => ({
      kind: 'file',
      path: asset.target,
      content: asset.content,
    })),
  ]
  if (scope === 'agents') {
    return { managed: agents, scripts: {}, devDependencies: {} }
  }

  // Git hooks and workflows live at the Git root, which may be above the configuration root.
  const up = gitPrefix === '' ? '' : '../'.repeat(gitPrefix.split('/').length)
  const hook =
    gitPrefix === ''
      ? preCommitBlock(packageManager)
      : `cd "${gitPrefix}" && ${preCommitBlock(packageManager)}`
  return {
    managed: [
      { kind: 'file', path: 'eslint.config.mjs', content: ESLINT_CONFIG },
      { kind: 'file', path: 'prettier.config.mjs', content: PRETTIER_CONFIG },
      { kind: 'block', path: `${up}${HUSKY_PRE_COMMIT}`, id: PRE_COMMIT_BLOCK_ID, content: hook },
      {
        kind: 'file',
        path: `${up}${CALLER_WORKFLOW_PATH}`,
        content: renderCallerWorkflow(resolved, identity),
      },
      ...agents,
    ],
    scripts: { ...MANAGED_SCRIPTS },
    devDependencies: profileDependencies(resolved, declared, identity.version),
  }
}
