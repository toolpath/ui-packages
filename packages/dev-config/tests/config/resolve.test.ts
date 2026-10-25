import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { defineConfig } from '../../src/config/define.js'
import { resolveConfig } from '../../src/config/resolve.js'
import { classifyFiles } from '../../src/config/scope.js'
import type { DevConfigInput, ProjectConfig } from '../../src/config/types.js'
import { ConfigError } from '../../src/errors.js'
import { createProject, type TestProject } from '../helpers/project.js'

const projects: Array<TestProject> = []
afterAll(() => {
  for (const created of projects) {
    created.remove()
  }
})

/** A repository with `packages/a`, `packages/b` and their tsconfig and runner files. */
const repository = (manifests: Record<string, object> = {}): TestProject => {
  const created = createProject({})
  projects.push(created)
  for (const name of ['a', 'b']) {
    mkdirSync(join(created.root, 'packages', name, 'src'), { recursive: true })
    writeFileSync(join(created.root, 'packages', name, 'tsconfig.json'), '{}\n')
    writeFileSync(join(created.root, 'packages', name, 'vitest.config.mjs'), '')
    const manifest = manifests[name]
    if (manifest) {
      writeFileSync(
        join(created.root, 'packages', name, 'package.json'),
        `${JSON.stringify(manifest)}\n`,
      )
    }
  }
  writeFileSync(join(created.root, 'tsconfig.json'), '{}\n')
  writeFileSync(join(created.root, 'vitest.config.mjs'), '')
  return created
}

const project = (name: string, overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  name,
  root: `packages/${name}`,
  kind: 'library',
  runtime: 'node',
  tsconfig: 'tsconfig.json',
  suites: { unit: { runner: 'vitest', config: 'vitest.config.mjs' } },
  ...overrides,
})

const resolveIn = (root: string, input: Partial<DevConfigInput>) =>
  resolveConfig(
    defineConfig({
      schemaVersion: 1,
      root: pathToFileURL(join(root, 'dev.config.mjs')).href,
      projects: [project('a'), project('b')],
      ci: { node: '24.18.0' },
      ...input,
    }),
  )

const issuesOf = (run: () => unknown): Array<string> => {
  try {
    run()
  } catch (error) {
    if (error instanceof ConfigError) {
      return error.issues.map((issue) => `${issue.path}: ${issue.message}`)
    }
    throw error
  }
  return []
}

describe('resolveConfig', () => {
  it('orders projects after their dependencies, adding workspace manifest dependencies', () => {
    const created = repository({
      a: { name: '@x/a', dependencies: { '@x/b': 'workspace:*' } },
      b: { name: '@x/b' },
    })
    const resolved = resolveIn(created.root, {})
    expect(resolved.projects.map((entry) => entry.name)).toEqual(['b', 'a'])
    expect(resolved.projects.find((entry) => entry.name === 'a')?.dependsOn).toEqual(['b'])
  })

  it('rejects duplicate names and roots', () => {
    const created = repository()
    expect(
      issuesOf(() =>
        resolveIn(created.root, { projects: [project('a'), project('a', { root: 'packages/b' })] }),
      ),
    ).toContainEqual(expect.stringMatching(/projects\[1\]\.name: "a" is already used/))
    expect(
      issuesOf(() =>
        resolveIn(created.root, { projects: [project('a'), project('b', { root: 'packages/a' })] }),
      ),
    ).toContainEqual(
      expect.stringMatching(/projects\[1\]\.root: packages\/a is already the root of "a"/),
    )
  })

  it('reports a dependency cycle, an unknown dependency, and a contradiction with the manifests', () => {
    const created = repository()
    expect(
      issuesOf(() =>
        resolveIn(created.root, {
          projects: [project('a', { dependsOn: ['b'] }), project('b', { dependsOn: ['a'] })],
        }),
      ),
    ).toContainEqual(expect.stringMatching(/dependency cycle: a -> b -> a/))
    expect(
      issuesOf(() =>
        resolveIn(created.root, {
          projects: [project('a', { dependsOn: ['missing'] }), project('b')],
        }),
      ),
    ).toContainEqual(expect.stringMatching(/"missing" is not a configured project/))
    const declared = repository({ a: { name: '@x/a' }, b: { name: '@x/b' } })
    expect(
      issuesOf(() =>
        resolveIn(declared.root, { projects: [project('a', { dependsOn: ['b'] }), project('b')] }),
      ),
    ).toContainEqual(expect.stringMatching(/packages\/a\/package\.json does not depend on @x\/b/))
  })

  it('names missing files and refuses an untested Node, an unknown contract and a bad external suite', () => {
    const created = repository()
    const issues = issuesOf(() =>
      resolveIn(created.root, {
        projects: [
          project('a', { tsconfig: 'tsconfig.missing.json' }),
          project('b', { root: 'packages/none' }),
        ],
        ci: { node: '22.0.0', externalSuites: [{ project: 'a', suite: 'unit', job: 'unit-job' }] },
        engine: { contract: 'api-0.0.0', integrationFiles: ['src/engine/**'] },
      }),
    )
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /projects\[0\]\.tsconfig: packages\/a\/tsconfig\.missing\.json does not exist/,
        ),
        expect.stringMatching(/projects\[1\]\.root: packages\/none is not a directory/),
        expect.stringMatching(/ci\.node: must be 24\.18\.0/),
        expect.stringMatching(/engine\.contract: "api-0\.0\.0" is not a supported contract/),
        expect.stringMatching(/a:unit is a unit suite; it always runs in the standards job/),
      ]),
    )
  })

  it('gives each file to its most specific project, and tooling globs win', () => {
    const created = repository()
    const resolved = resolveIn(created.root, {
      projects: [project('root', { root: '.' }), project('a'), project('b')],
      tooling: { files: ['**/vitest.config.mjs'], tsconfig: 'tsconfig.json' },
      generated: [
        { files: ['packages/b/src/generated/**'], reason: 'Written by the client generator' },
      ],
    })
    const scope = classifyFiles(resolved, [
      'scripts/build.ts',
      'packages/a/src/index.ts',
      'packages/a/vitest.config.mjs',
      'packages/b/src/generated/client.ts',
      'packages/b/src/generated-helpers.ts',
      'README.md',
    ])
    const owner = (path: string): string | undefined => {
      const found = scope.owned.get(path)
      return found?.kind === 'tooling' ? 'tooling' : found?.project.name
    }
    expect(owner('scripts/build.ts')).toBe('root')
    expect(owner('packages/a/src/index.ts')).toBe('a')
    expect(owner('packages/a/vitest.config.mjs')).toBe('tooling')
    expect(scope.generated).toEqual(['packages/b/src/generated/client.ts'])
    expect(owner('packages/b/src/generated-helpers.ts')).toBe('b')
    expect(scope.owned.has('README.md')).toBe(false)
  })
})
