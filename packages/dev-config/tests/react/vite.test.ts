import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { CheckFailure, ConfigError } from '../../src/errors.js'
import { inspectCompiledOutput } from '../../src/react/compiler.js'
import {
  createReactPlugins,
  verifyViteReactCompiler,
  type ReactVitePlugin,
} from '../../src/react/vite.js'
import { COUNTER_SOURCE, createTestProject, linkPeerOf, type TestProject } from './project.js'

interface BuildOutput {
  output: Array<{
    type: string
    fileName: string
    code?: string
    map?: { sources: Array<string> } | null
  }>
}
interface Vite {
  build: (config: Record<string, unknown>) => Promise<BuildOutput | Array<BuildOutput>>
}

const projects: Array<TestProject> = []
const project = (adapter: 'vite-modern' | 'vite-legacy'): TestProject => {
  const created = createTestProject({ adapter, files: { 'src/Counter.tsx': COUNTER_SOURCE } })
  linkPeerOf(created, 'vite', '@vitejs/plugin-react')
  projects.push(created)
  return created
}

afterAll(() => {
  for (const created of projects) {
    created.remove()
  }
})

const loadVite = async (directory: string): Promise<Vite> =>
  (await import(
    pathToFileURL(createRequire(join(directory, 'package.json')).resolve('vite')).href
  )) as Vite

/** A library-mode build of the counter with React external, so the compiler runtime import stays visible. */
const buildCounter = async (
  directory: string,
  plugins: Array<ReactVitePlugin>,
): Promise<BuildOutput['output'][number]> => {
  const vite = await loadVite(directory)
  const result = await vite.build({
    root: directory,
    configFile: false,
    logLevel: 'silent',
    plugins,
    build: {
      write: false,
      sourcemap: true,
      minify: false,
      lib: { entry: join(directory, 'src/Counter.tsx'), formats: ['es'], fileName: 'counter' },
      rolldownOptions: { external: [/^react(\/|$)/] },
    },
  })
  const [first] = [result].flat()
  const chunk = first?.output.find((entry) => entry.type === 'chunk')
  if (!chunk) {
    throw new Error('Vite produced no chunk')
  }
  return chunk
}

describe('createReactPlugins (vite-modern)', () => {
  it('compiles components with React Compiler before JSX is lowered, with a source map', async () => {
    const modern = project('vite-modern')
    const plugins = await createReactPlugins(modern.config, { project: 'app' })
    // plugin-react's own plugins first, then the compiler's Babel pass.
    expect(plugins.map((plugin) => plugin.name).at(-1)).toBe('@rolldown/plugin-babel')
    const chunk = await buildCounter(modern.directory, plugins)
    const evidence = inspectCompiledOutput(chunk.code ?? '')
    expect(evidence).toMatchObject({ compiled: true, runtimeModule: 'react/compiler-runtime' })
    // JSX reaches the compiler untouched: the memoized element is built with the automatic runtime.
    // (Vitest sets NODE_ENV=test, so Vite picks the development JSX runtime here.)
    expect(chunk.code).toMatch(/from\s*["']react\/jsx-(?:dev-)?runtime["']/)
    expect(chunk.map?.sources.some((source) => source.endsWith('Counter.tsx'))).toBe(true)
  })

  it('rejects the plugin options the adapter owns', async () => {
    const modern = project('vite-modern')
    await expect(
      createReactPlugins(modern.config, { project: 'app', react: { babel: {} } }),
    ).rejects.toThrow(ConfigError)
  })

  it('refuses a declared adapter that does not match the installed plugin', async () => {
    const legacy = project('vite-legacy')
    await expect(createReactPlugins(legacy.config, { project: 'app' })).rejects.toThrow(
      /vite-modern/,
    )
  })
})

describe('verifyViteReactCompiler', () => {
  it("passes for a project's real config that uses the factory", async () => {
    const modern = project('vite-modern')
    modern.write(
      'vite.config.mjs',
      `import config from './dev.config.mjs'
import { createReactPlugins } from '@toolpath/dev-config/react/vite'

export default { plugins: [...(await createReactPlugins(config, { project: 'app' }))] }
`,
    )
    await expect(verifyViteReactCompiler({ root: modern.directory })).resolves.toMatchObject({
      compiled: true,
    })
  })

  it('fails when the compiler is installed but the config never wires it in', async () => {
    const unwired = project('vite-modern')
    unwired.write(
      'vite.config.mjs',
      `import react from '@vitejs/plugin-react'

export default { plugins: [react()] }
`,
    )
    await expect(verifyViteReactCompiler({ root: unwired.directory })).rejects.toThrow(CheckFailure)
  })
})
