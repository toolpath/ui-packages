import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig } from '../../src/config/define.js'
import type {
  DevConfig,
  ProjectConfig,
  ReactAdapter,
  ReactMinimumVersion,
} from '../../src/config/types.js'

/**
 * Disposable React projects inside the package's ignored `.tmp/` directory, so
 * Node resolves the workspace's installed build tools (and the package itself,
 * by self-reference) from them exactly as from a consumer.
 */
// From the string URL, not `new URL(...)`: the jsdom environment replaces the global `URL`.
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const temporaryRoot = join(packageRoot, '.tmp')

export interface TestProject {
  directory: string
  config: DevConfig
  write: (path: string, content: string) => void
  remove: () => void
}

export interface TestProjectOptions {
  adapter: ReactAdapter
  minimumVersion?: ReactMinimumVersion
  runtime?: ProjectConfig['runtime']
  kind?: ProjectConfig['kind']
  manifest?: Record<string, unknown>
  files?: Record<string, string>
}

const devConfigSource = (
  project: ProjectConfig,
): string => `import { defineConfig } from '@toolpath/dev-config'

export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [${JSON.stringify(project)}],
  ci: { node: '24.18.0' },
})
`

export const createTestProject = (options: TestProjectOptions): TestProject => {
  mkdirSync(temporaryRoot, { recursive: true })
  const directory = realpathSync(mkdtempSync(join(temporaryRoot, `react-${options.adapter}-`)))
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(directory, path)), { recursive: true })
    writeFileSync(join(directory, path), content)
  }
  const project: ProjectConfig = {
    name: 'app',
    root: '.',
    kind: options.kind ?? 'application',
    runtime: options.runtime ?? 'dom',
    tsconfig: 'tsconfig.json',
    react: {
      adapter: options.adapter,
      ...(options.minimumVersion === undefined ? {} : { minimumVersion: options.minimumVersion }),
    },
    noUnitTests: { reason: 'A disposable adapter test project with no suites of its own' },
  }
  write(
    'package.json',
    `${JSON.stringify({ name: 'react-adapter-probe', private: true, type: 'module', ...options.manifest }, null, 2)}\n`,
  )
  write('tsconfig.json', '{}\n')
  write('dev.config.mjs', devConfigSource(project))
  for (const [path, content] of Object.entries(options.files ?? {})) {
    write(path, content)
  }
  // The project's own package.json scopes its files, so the package is linked in as a consumer installs it.
  mkdirSync(join(directory, 'node_modules', '@toolpath'), { recursive: true })
  symlinkSync(packageRoot, join(directory, 'node_modules', '@toolpath', 'dev-config'), 'dir')
  const config = defineConfig({
    schemaVersion: 1,
    root: pathToFileURL(join(directory, 'dev.config.mjs')).href,
    projects: [project],
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

/**
 * Links a package that the workspace installs only as another package's peer
 * (`vite`, beside `@vitejs/plugin-react`) into the test project, the way a
 * consumer's own dependency would sit there.
 */
export const linkPeerOf = (project: TestProject, name: string, owner: string): void => {
  const ownerManifest = realpathSync(join(packageRoot, 'node_modules', owner, 'package.json'))
  const resolved = createRequire(ownerManifest).resolve(`${name}/package.json`)
  const target = join(project.directory, 'node_modules', name)
  mkdirSync(dirname(target), { recursive: true })
  symlinkSync(dirname(resolved), target, 'dir')
}

export const COUNTER_SOURCE = `import { useState } from 'react'

export const Counter = ({ label }: { label: string }) => {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {label}: {count}
    </button>
  )
}
`
