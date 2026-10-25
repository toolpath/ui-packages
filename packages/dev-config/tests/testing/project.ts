import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig } from '../../src/config/define.js'
import type { DevConfig, ProjectConfig } from '../../src/config/types.js'

/**
 * A disposable project with declared suites, inside the package's ignored
 * `.tmp/` so the workspace's runners resolve from it as they would for a
 * consumer.
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export interface SuiteProject {
  directory: string
  config: DevConfig
  write: (path: string, content: string) => void
  remove: () => void
}

export const createSuiteProject = (
  project: Omit<ProjectConfig, 'name' | 'root' | 'tsconfig'>,
  files: Record<string, string> = {},
): SuiteProject => {
  mkdirSync(join(packageRoot, '.tmp'), { recursive: true })
  const directory = realpathSync(mkdtempSync(join(packageRoot, '.tmp', 'suite-')))
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(directory, path)), { recursive: true })
    writeFileSync(join(directory, path), content)
  }
  const declared: ProjectConfig = { name: 'app', root: '.', tsconfig: 'tsconfig.json', ...project }
  write('package.json', '{"name":"suite-probe","private":true,"type":"module"}\n')
  write('tsconfig.json', '{}\n')
  write(
    'dev.config.mjs',
    `import { defineConfig } from '@toolpath/dev-config'

export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [${JSON.stringify(declared)}],
  ci: { node: '24.18.0' },
})
`,
  )
  for (const suite of Object.values(project.suites ?? {})) {
    if ('config' in suite && !(suite.config in files)) {
      write(suite.config, 'export default {}\n')
    }
  }
  for (const [path, content] of Object.entries(files)) {
    write(path, content)
  }
  mkdirSync(join(directory, 'node_modules', '@toolpath'), { recursive: true })
  symlinkSync(packageRoot, join(directory, 'node_modules', '@toolpath', 'dev-config'), 'dir')
  const config = defineConfig({
    schemaVersion: 1,
    root: pathToFileURL(join(directory, 'dev.config.mjs')).href,
    projects: [declared],
    ci: { node: '24.18.0' },
  })
  return {
    directory,
    config,
    write,
    remove: () => {
      rmSync(directory, { recursive: true, force: true })
    },
  }
}
