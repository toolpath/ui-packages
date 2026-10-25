import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const packageRoot = fileURLToPath(new URL('../..', import.meta.url))
const temporaryRoot = join(packageRoot, '.tmp')
const cli = join(packageRoot, 'dist/cli/main.js')

/** A path relative to the project root, for messages. */
export const inProject = (root: string, path: string): string =>
  relative(root, path).split('\\').join('/')

export interface TestProject {
  root: string
  write: (files: Record<string, string>) => void
  run: (
    args: Array<string>,
    options?: { cwd?: string; env?: NodeJS.ProcessEnv },
  ) => { code: number | null; stdout: string; stderr: string }
  start: (args: Array<string>) => ReturnType<typeof spawn>
  remove: () => void
}

/**
 * A disposable Git repository under the package's ignored `.tmp/`. The built
 * package is linked at `node_modules/@toolpath/dev-config`, so configuration
 * imports it by name exactly as a consumer does, and its own tools resolve from
 * the real package directory.
 */
export const createProject = (files: Record<string, string>): TestProject => {
  mkdirSync(temporaryRoot, { recursive: true })
  const root = mkdtempSync(join(temporaryRoot, 'project-'))
  const write = (entries: Record<string, string>): void => {
    for (const [path, content] of Object.entries(entries)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), content)
    }
  }
  write({
    'package.json': '{ "name": "fixture", "private": true, "type": "module" }\n',
    '.gitignore': 'node_modules/\n',
    ...files,
  })
  mkdirSync(join(root, 'node_modules/@toolpath'), { recursive: true })
  symlinkSync(packageRoot, join(root, 'node_modules/@toolpath/dev-config'), 'dir')
  spawnSync('git', ['init', '--quiet'], { cwd: root })
  return {
    root,
    write,
    run: (args, options = {}) => {
      const result = spawnSync(process.execPath, [cli, ...args], {
        cwd: options.cwd ?? root,
        encoding: 'utf8',
        env: { ...process.env, CI: '', ...options.env },
      })
      return { code: result.status, stdout: result.stdout, stderr: result.stderr }
    },
    start: (args) =>
      spawn(process.execPath, [cli, ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }),
    remove: () => {
      rmSync(root, { recursive: true, force: true })
    },
  }
}

export interface ProjectFacts {
  name: string
  root?: string
  runtime?: 'node' | 'dom' | 'native' | 'universal'
  extra?: string
}

/** A `dev.config.mjs` source for one or more projects with Vitest unit suites. */
export const devConfig = (
  projects: Array<ProjectFacts>,
  top = '',
): string => `import { defineConfig } from '@toolpath/dev-config'

export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [
${projects
  .map(
    (project) => `    {
      name: '${project.name}',
      root: '${project.root ?? '.'}',
      kind: 'library',
      runtime: '${project.runtime ?? 'node'}',
      tsconfig: 'tsconfig.json',
      suites: { unit: { runner: 'vitest', config: 'vitest.config.mjs' } },
      ${project.extra ?? ''}
    },`,
  )
  .join('\n')}
  ],
  ci: { node: '24.18.0' },
  ${top}
})
`

export const eslintConfig = (extra = ''): string => `import config from './dev.config.mjs'
import { createEslintConfig } from '@toolpath/dev-config/eslint'

const base = await createEslintConfig(config)
export default [...base${extra}]
`

export const vitestConfig = (
  project: string,
  configImport = './dev.config.mjs',
): string => `import config from '${configImport}'
import { createVitestConfig } from '@toolpath/dev-config/vitest'

export default createVitestConfig(config, { project: '${project}', suite: 'unit' })
`

/** A strict tsconfig covering the given globs; JavaScript files are checked too. */
export const tsconfig = ({
  preset = 'node',
  include = ['src', '*.mjs'],
}: { preset?: string; include?: Array<string> } = {}): string =>
  `${JSON.stringify(
    {
      extends: `@toolpath/dev-config/typescript/${preset}.json`,
      compilerOptions: { types: ['node'], allowJs: true, checkJs: true },
      include,
    },
    null,
    2,
  )}\n`
