import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig } from '../../src/config/define.js'
import { resolveConfig, type ResolvedConfig } from '../../src/config/resolve.js'
import type { DevConfigInput } from '../../src/config/types.js'
import { toolchain } from '../../src/policy/toolchain.js'
import { ACTION_PATHS, WORKFLOW_PATH, type ReleaseIdentity } from '../../src/release/metadata.js'

const directories: Array<string> = []

/** A disposable directory holding `files`; removed by `removeRepositories`. */
export const createRepository = (files: Record<string, string>): string => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'dev-config-ci-')))
  directories.push(directory)
  for (const [path, content] of Object.entries(files)) {
    const file = join(directory, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
  return directory
}

export const removeRepositories = (): void => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
}

type FixtureInput = Omit<DevConfigInput, 'schemaVersion' | 'root' | 'ci'> & {
  ci?: Partial<DevConfigInput['ci']>
}

/** A resolved configuration over a disposable repository with the files it names. */
export const resolveFixture = (
  input: FixtureInput,
  files: Record<string, string> = {},
): { directory: string; resolved: ResolvedConfig } => {
  const directory = createRepository({ 'dev.config.mjs': '', 'tsconfig.json': '{}\n', ...files })
  const config = defineConfig({
    schemaVersion: 1,
    root: pathToFileURL(join(directory, 'dev.config.mjs')).href,
    ...input,
    ci: { node: toolchain.runtime.node, ...input.ci },
  })
  return { directory, resolved: resolveConfig(config) }
}

/** One app with a unit suite, a central browser suite, a delegated service suite, and a manual one. */
export const appWithSuites = (): FixtureInput => ({
  projects: [
    {
      name: 'core',
      root: 'packages/core',
      kind: 'library',
      runtime: 'universal',
      tsconfig: 'tsconfig.json',
      build: { argv: ['node', 'build.mjs'], outputs: ['dist'] },
      suites: { unit: { runner: 'vitest', config: 'vitest.config.ts' } },
    },
    {
      name: 'app',
      root: 'apps/app',
      kind: 'application',
      runtime: 'dom',
      tsconfig: 'tsconfig.json',
      dependsOn: ['core'],
      suites: {
        unit: { runner: 'vitest', config: 'vitest.config.ts' },
        browser: { runner: 'playwright', config: 'playwright.config.ts', browsers: ['chromium'] },
        integration: {
          runner: 'command',
          argv: ['node', 'scripts/integration.mjs'],
          report: { format: 'junit', path: 'reports/integration.xml' },
          prerequisites: { env: ['DATABASE_URL'], commands: ['psql'] },
          timeoutMinutes: 40,
        },
        device: {
          runner: 'command',
          argv: ['node', 'scripts/device.mjs'],
          report: { format: 'junit', path: 'reports/device.xml' },
          ci: 'manual',
          reason: 'Needs a connected device that hosted runners do not have',
        },
      },
    },
  ],
  ci: { externalSuites: [{ project: 'app', suite: 'integration', job: 'app-integration' }] },
})

export const appFiles = {
  'packages/core/tsconfig.json': '{}\n',
  'packages/core/vitest.config.ts': '',
  'apps/app/tsconfig.json': '{}\n',
  'apps/app/vitest.config.ts': '',
  'apps/app/playwright.config.ts': '',
}

export const FIXTURE_SHA = 'a'.repeat(40)

export const releaseIdentity = (sha = FIXTURE_SHA): ReleaseIdentity => ({
  schemaVersion: 1,
  name: '@toolpath/dev-config',
  version: '1.2.3',
  policyVersion: toolchain.policyVersion,
  channel: 'release',
  repository: 'toolpath/ui-packages',
  sourceSha: sha,
  dirty: false,
  workflow: `toolpath/ui-packages/${WORKFLOW_PATH}@${sha}`,
  actions: {
    setup: `toolpath/ui-packages/${ACTION_PATHS.setup}@${sha}`,
    check: `toolpath/ui-packages/${ACTION_PATHS.check}@${sha}`,
    result: `toolpath/ui-packages/${ACTION_PATHS.result}@${sha}`,
  },
  toolchain,
})
