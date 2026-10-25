import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { UsageError } from '../errors.js'
import { toolchain, type Toolchain } from '../policy/toolchain.js'

/** Repository paths whose content is part of what a dev-config release means. */
export const RELEASE_SOURCE_PATHS = [
  'packages/dev-config',
  '.github/workflows/dev-config-quality.yml',
  '.github/actions/dev-config-setup',
  '.github/actions/dev-config-check',
  '.github/actions/dev-config-result',
] as const

export const WORKFLOW_PATH = '.github/workflows/dev-config-quality.yml'
export const ACTION_PATHS = {
  setup: '.github/actions/dev-config-setup',
  check: '.github/actions/dev-config-check',
  result: '.github/actions/dev-config-result',
} as const

export type ReleaseChannel = 'release' | 'development'

/**
 * Binds an installed package to the exact workflow and action source it was
 * released with. `init`/`sync` write these full-SHA references into a consumer,
 * and `doctor` compares them, so package and CI policy move together.
 */
export interface ReleaseIdentity {
  schemaVersion: 1
  name: string
  version: string
  policyVersion: number
  channel: ReleaseChannel
  /** `owner/name` on GitHub.com. */
  repository: string
  /** The full commit SHA the package was built from; `null` outside a Git checkout. */
  sourceSha: string | null
  /** Development builds only: whether release-relevant paths had uncommitted changes. */
  dirty: boolean
  workflow: string
  actions: { setup: string; check: string; result: string }
  toolchain: Toolchain
}

const git = (
  cwd: string,
  args: ReadonlyArray<string>,
): { status: number | null; stdout: string } => {
  const result = spawnSync('git', [...args], { cwd, encoding: 'utf8' })
  return { status: result.status, stdout: result.stdout.trim() }
}

export const repositorySlug = (url: string): string => {
  const match = /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(url.trim())
  if (!match?.[1]) {
    throw new UsageError(`Cannot read a GitHub repository from "${url}".`)
  }
  return match[1]
}

export interface ReleaseIdentityOptions {
  packageRoot: string
  channel: ReleaseChannel
}

/**
 * Computes the identity for a build. A release build refuses a dirty relevant
 * source tree and a commit that does not contain the version being packed:
 * published metadata must name a commit whose workflow is the one shipped.
 */
export const createReleaseIdentity = ({
  packageRoot,
  channel,
}: ReleaseIdentityOptions): ReleaseIdentity => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    name: string
    version: string
    repository: { url: string }
  }
  const top = git(packageRoot, ['rev-parse', '--show-toplevel'])
  const inGit = top.status === 0 && top.stdout !== ''
  const sha = inGit ? git(packageRoot, ['rev-parse', 'HEAD']) : undefined
  const sourceSha = sha?.status === 0 && /^[0-9a-f]{40}$/.test(sha.stdout) ? sha.stdout : null
  let dirty = false
  if (inGit) {
    const status = git(top.stdout, ['status', '--porcelain', '--', ...RELEASE_SOURCE_PATHS])
    dirty = status.stdout !== ''
  }

  if (channel === 'release') {
    if (!inGit || sourceSha === null) {
      throw new UsageError(
        'A release build of @toolpath/dev-config must run in a Git checkout with a commit.',
      )
    }
    if (dirty) {
      throw new UsageError(
        'Release-relevant files have uncommitted changes. Publish only from the clean commit that contains them:\n' +
          git(top.stdout, ['status', '--short', '--', ...RELEASE_SOURCE_PATHS]).stdout,
      )
    }
    const manifestPath = relative(top.stdout, join(packageRoot, 'package.json'))
      .split('\\')
      .join('/')
    const committed = git(top.stdout, ['show', `HEAD:${manifestPath}`])
    const committedVersion =
      committed.status === 0
        ? (JSON.parse(committed.stdout) as { version?: string }).version
        : undefined
    if (committedVersion !== manifest.version) {
      throw new UsageError(
        `HEAD records ${manifest.name}@${committedVersion ?? '(none)'}, but the package being built is ${manifest.version}. ` +
          'Commit the version before publishing so the release names the commit it came from.',
      )
    }
  }

  const repository = repositorySlug(manifest.repository.url)
  const ref = sourceSha ?? 'unknown'
  return {
    schemaVersion: 1,
    name: manifest.name,
    version: manifest.version,
    policyVersion: toolchain.policyVersion,
    channel,
    repository,
    sourceSha,
    dirty: channel === 'release' ? false : dirty,
    workflow: `${repository}/${WORKFLOW_PATH}@${ref}`,
    actions: {
      setup: `${repository}/${ACTION_PATHS.setup}@${ref}`,
      check: `${repository}/${ACTION_PATHS.check}@${ref}`,
      result: `${repository}/${ACTION_PATHS.result}@${ref}`,
    },
    toolchain,
  }
}

/**
 * What a consumer's `init`/`sync` accept. Development metadata (from a local or
 * PR build) cannot be written into a consumer: its SHA may not contain the
 * workflow it names.
 */
export const assertInstallableIdentity = (identity: ReleaseIdentity): void => {
  if (
    identity.channel !== 'release' ||
    identity.sourceSha === null ||
    !/^[0-9a-f]{40}$/.test(identity.sourceSha)
  ) {
    throw new UsageError(
      `This @toolpath/dev-config build (${identity.version}) carries development release metadata, which names no ` +
        'published workflow revision. Install a published release from npm to initialize or synchronize a repository.',
    )
  }
}
