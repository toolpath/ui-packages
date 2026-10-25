import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertInstallableIdentity,
  createReleaseIdentity,
  repositorySlug,
} from '../../src/release/metadata.js'

const roots: Array<string> = []
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

const git = (cwd: string, ...args: Array<string>): string => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr)
  }
  return result.stdout.trim()
}

/** A repository shaped like the host: the package and its shared workflow. */
const host = (): { root: string; packageRoot: string } => {
  const root = mkdtempSync(join(tmpdir(), 'toolpath-dev-release-'))
  roots.push(root)
  const packageRoot = join(root, 'packages/dev-config')
  mkdirSync(join(root, '.github/workflows'), { recursive: true })
  mkdirSync(packageRoot, { recursive: true })
  writeFileSync(
    join(packageRoot, 'package.json'),
    `${JSON.stringify({ name: '@toolpath/dev-config', version: '1.0.0', repository: { url: 'https://github.com/toolpath/ui-packages.git' } })}\n`,
  )
  writeFileSync(join(root, '.github/workflows/dev-config-quality.yml'), 'name: Quality\n')
  git(root, 'init', '--quiet')
  git(root, 'config', 'user.email', 'release@example.invalid')
  git(root, 'config', 'user.name', 'Release')
  git(root, 'add', '.')
  git(root, 'commit', '--quiet', '-m', 'release')
  return { root, packageRoot }
}

describe('release identity', () => {
  it('binds a clean release to the full commit that contains its workflow', () => {
    const { root, packageRoot } = host()
    const identity = createReleaseIdentity({ packageRoot, channel: 'release' })
    const sha = git(root, 'rev-parse', 'HEAD')
    expect(identity).toMatchObject({
      channel: 'release',
      sourceSha: sha,
      dirty: false,
      repository: 'toolpath/ui-packages',
    })
    expect(identity.workflow).toBe(
      `toolpath/ui-packages/.github/workflows/dev-config-quality.yml@${sha}`,
    )
    expect(() => {
      assertInstallableIdentity(identity)
    }).not.toThrow()
  })

  it('refuses a release from a dirty workflow or an uncommitted version', () => {
    const { root, packageRoot } = host()
    writeFileSync(join(root, '.github/workflows/dev-config-quality.yml'), 'name: Changed\n')
    expect(() => createReleaseIdentity({ packageRoot, channel: 'release' })).toThrow(
      /uncommitted changes/,
    )
    git(root, 'checkout', '--', '.github')
    cpSync(join(packageRoot, 'package.json'), join(root, 'backup.json'))
    writeFileSync(
      join(packageRoot, 'package.json'),
      JSON.stringify({
        name: '@toolpath/dev-config',
        version: '2.0.0',
        repository: { url: 'git@github.com:toolpath/ui-packages.git' },
      }),
    )
    git(root, 'stash', '--quiet')
    git(root, 'stash', 'pop', '--quiet')
    expect(() => createReleaseIdentity({ packageRoot, channel: 'release' })).toThrow(
      /uncommitted changes|HEAD records/,
    )
  })

  it('marks development builds, which consumers refuse to install', () => {
    const { root, packageRoot } = host()
    writeFileSync(join(root, '.github/workflows/dev-config-quality.yml'), 'name: Changed\n')
    const identity = createReleaseIdentity({ packageRoot, channel: 'development' })
    expect(identity).toMatchObject({ channel: 'development', dirty: true })
    expect(() => {
      assertInstallableIdentity(identity)
    }).toThrow(/development release metadata/)
  })

  it('reads the GitHub repository from any common URL form', () => {
    expect(repositorySlug('https://github.com/toolpath/ui-packages.git')).toBe(
      'toolpath/ui-packages',
    )
    expect(repositorySlug('git@github.com:toolpath/ui-packages.git')).toBe('toolpath/ui-packages')
    expect(repositorySlug('git+https://github.com/toolpath/ui-packages')).toBe(
      'toolpath/ui-packages',
    )
  })
})
