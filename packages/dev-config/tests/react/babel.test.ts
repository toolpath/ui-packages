import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { CheckFailure, ConfigError, MissingPeerError } from '../../src/errors.js'
import {
  createBabelConfig,
  createReactCompilerBabelPlugin,
  createReactRouterCompilerPlugin,
  verifyBabelReactCompiler,
} from '../../src/react/babel.js'
import { inspectCompiledOutput } from '../../src/react/compiler.js'
import { verifyViteReactCompiler, type ReactVitePlugin } from '../../src/react/vite.js'
import { COUNTER_SOURCE, createTestProject, linkPeerOf, type TestProject } from './project.js'

interface Babel {
  transformAsync: (
    code: string,
    options: Record<string, unknown>,
  ) => Promise<{ code?: string | null } | null>
}
interface BuildOutput {
  output: Array<{ type: string; code?: string }>
}
interface Vite {
  build: (config: Record<string, unknown>) => Promise<BuildOutput | Array<BuildOutput>>
}

const projects: Array<TestProject> = []
const track = (project: TestProject): TestProject => {
  projects.push(project)
  return project
}

afterAll(() => {
  for (const project of projects) {
    project.remove()
  }
})

const babelFor = async (directory: string): Promise<Babel> =>
  (await import(
    pathToFileURL(createRequire(join(directory, 'package.json')).resolve('@babel/core')).href
  )) as Babel

/**
 * Stands in for `@babel/preset-typescript`, which the workspace does not install:
 * it only enables the TypeScript and JSX parser so the compiler sees TSX. The
 * compatibility harness runs the real preset.
 */
const SYNTAX_PRESET = `module.exports = () => ({
  plugins: [{ manipulateOptions: (_options, parserOptions) => { parserOptions.plugins.push('jsx', 'typescript') } }],
})
`

describe('createBabelConfig', () => {
  it('puts the compiler first and compiles a component', async () => {
    const project = track(createTestProject({ adapter: 'babel' }))
    const config = createBabelConfig(project.config, {
      project: 'app',
      plugins: ['./later-plugin.cjs'],
    })
    expect(config.plugins[0]?.[0]).toContain('babel-plugin-react-compiler')
    expect(config.plugins[1]).toBe('./later-plugin.cjs')
    const babel = await babelFor(project.directory)
    const result = await babel.transformAsync(COUNTER_SOURCE, {
      filename: join(project.directory, 'Counter.tsx'),
      babelrc: false,
      configFile: false,
      parserOpts: { plugins: ['jsx', 'typescript'] },
      plugins: [createReactCompilerBabelPlugin(project.config, { project: 'app' })],
    })
    expect(inspectCompiledOutput(result?.code ?? '').compiled).toBe(true)
  })

  it('is only for the babel and react-router adapters', () => {
    const vite = track(createTestProject({ adapter: 'vite-modern' }))
    expect(() => createBabelConfig(vite.config, { project: 'app' })).toThrow(ConfigError)
  })
})

describe('verifyBabelReactCompiler', () => {
  it("passes when the project's Babel config uses the factory", async () => {
    const project = track(
      createTestProject({
        adapter: 'babel',
        files: {
          'babel.config.mjs': `import config from './dev.config.mjs'
import { createBabelConfig } from '@toolpath/dev-config/react/babel'

export default createBabelConfig(config, { project: 'app' })
`,
        },
      }),
    )
    await expect(verifyBabelReactCompiler({ root: project.directory })).resolves.toMatchObject({
      compiled: true,
    })
  })

  it('fails when the Babel config does not run the compiler', async () => {
    const project = track(
      createTestProject({ adapter: 'babel', files: { 'babel.config.json': '{}\n' } }),
    )
    await expect(verifyBabelReactCompiler({ root: project.directory })).rejects.toThrow(
      CheckFailure,
    )
  })

  it('names the missing configuration file', async () => {
    const project = track(createTestProject({ adapter: 'babel' }))
    await expect(verifyBabelReactCompiler({ root: project.directory })).rejects.toThrow(
      /no Babel configuration/,
    )
  })
})

describe('createReactRouterCompilerPlugin', () => {
  it('fails with the install command when @babel/preset-typescript is missing', async () => {
    const project = track(createTestProject({ adapter: 'react-router' }))
    const created = createReactRouterCompilerPlugin(project.config, { project: 'app' })
    await expect(created).rejects.toThrow(MissingPeerError)
    await expect(
      createReactRouterCompilerPlugin(project.config, { project: 'app' }),
    ).rejects.toThrow(/--save-exact @babel\/preset-typescript@7\.29\.7/)
  })

  it('compiles .tsx routes through vite-plugin-babel inside a real Vite build', async () => {
    const project = track(
      createTestProject({
        adapter: 'react-router',
        files: {
          'app/routes/counter.tsx': COUNTER_SOURCE,
          'node_modules/@babel/preset-typescript/package.json':
            '{"name":"@babel/preset-typescript","version":"7.29.7","main":"index.cjs"}\n',
          'node_modules/@babel/preset-typescript/index.cjs': SYNTAX_PRESET,
        },
      }),
    )
    linkPeerOf(project, 'vite', '@vitejs/plugin-react')
    const plugin: ReactVitePlugin = await createReactRouterCompilerPlugin(project.config, {
      project: 'app',
    })
    expect(plugin.name).toBe('babel-plugin')
    const vite = (await import(
      pathToFileURL(createRequire(join(project.directory, 'package.json')).resolve('vite')).href
    )) as Vite
    const result = await vite.build({
      root: project.directory,
      configFile: false,
      logLevel: 'silent',
      plugins: [plugin],
      build: {
        write: false,
        minify: false,
        lib: {
          entry: join(project.directory, 'app/routes/counter.tsx'),
          formats: ['es'],
          fileName: 'counter',
        },
        rolldownOptions: { external: [/^react(\/|$)/] },
      },
    })
    const chunk = [result].flat()[0]?.output.find((entry) => entry.type === 'chunk')
    expect(inspectCompiledOutput(chunk?.code ?? '').compiled).toBe(true)

    project.write(
      'vite.config.mjs',
      `import config from './dev.config.mjs'
import { createReactRouterCompilerPlugin } from '@toolpath/dev-config/react/babel'

export default { plugins: [await createReactRouterCompilerPlugin(config, { project: 'app' })] }
`,
    )
    await expect(verifyViteReactCompiler({ root: project.directory })).resolves.toMatchObject({
      compiled: true,
    })
  })
})
