import { afterAll, describe, expect, it } from 'vitest'
import { resolveConfig } from '../../src/config/resolve.js'
import { lowestMajor, reactAdapterIssues } from '../../src/react/requirements.js'
import {
  createTestProject,
  linkPeerOf,
  type TestProject,
  type TestProjectOptions,
} from './project.js'

const projects: Array<TestProject> = []
const issuesFor = (
  options: TestProjectOptions,
): { project: TestProject; messages: Array<string> } => {
  const project = createTestProject(options)
  projects.push(project)
  return {
    project,
    messages: reactAdapterIssues(resolveConfig(project.config)).map(
      (issue) => `${issue.path}: ${issue.message}`,
    ),
  }
}

afterAll(() => {
  for (const project of projects) {
    project.remove()
  }
})

const WIRED_VITE = `import config from './dev.config.mjs'
import { createReactPlugins } from '@toolpath/dev-config/react/vite'
export default { plugins: [...(await createReactPlugins(config, { project: 'app' }))] }
`

describe('reactAdapterIssues', () => {
  it('reports a build config that never imports the adapter', () => {
    const { messages } = issuesFor({
      adapter: 'vite-modern',
      files: {
        'vite.config.ts':
          "import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n",
      },
    })
    expect(messages).toContainEqual(
      expect.stringMatching(
        /^vite\.config\.ts: does not import @toolpath\/dev-config\/react\/vite/,
      ),
    )
  })

  it('reports a missing build config and accepts a wired one', () => {
    expect(issuesFor({ adapter: 'vite-modern' }).messages).toContainEqual(
      expect.stringContaining('no vite.config.ts found'),
    )
    const wired = issuesFor({ adapter: 'vite-modern', files: { 'vite.config.mjs': WIRED_VITE } })
    expect(wired.messages.filter((message) => message.includes('does not import'))).toEqual([])
  })

  it('compares installed adapter tools with the tested versions', () => {
    const { project } = issuesFor({
      adapter: 'vite-modern',
      files: { 'vite.config.mjs': WIRED_VITE },
    })
    const before = reactAdapterIssues(resolveConfig(project.config)).map((issue) => issue.message)
    expect(before).toContainEqual(expect.stringMatching(/needs vite@8\.3\.5 .*not installed/))
    linkPeerOf(project, 'vite', '@vitejs/plugin-react')
    const after = reactAdapterIssues(resolveConfig(project.config)).map((issue) => issue.message)
    expect(after).not.toContainEqual(expect.stringMatching(/needs vite@/))
    // The workspace resolves vite 8.2.1 beside plugin-react; the release is tested with 8.3.5.
    expect(after).toContainEqual(
      expect.stringMatching(/^vite@8\.\d+\.\d+ is installed; this release is tested with 8\.3\.5/),
    )
  })

  it('requires the compiler target to cover the oldest React the package accepts', () => {
    const { messages } = issuesFor({
      adapter: 'library-esbuild',
      kind: 'library',
      runtime: 'universal',
      manifest: { peerDependencies: { react: '^18.2.0 || ^19.0.0' } },
      files: {
        'tsup.config.ts':
          "import { reactCompilerEsbuildPlugin } from '@toolpath/dev-config/react/library'\n",
      },
    })
    expect(messages).toContainEqual(
      expect.stringContaining(
        "allows React 18 (^18.2.0 || ^19.0.0), but react.minimumVersion is '19'",
      ),
    )
  })

  it('requires react-compiler-runtime as a real dependency for a React 17/18 target', () => {
    const missing = issuesFor({
      adapter: 'library-esbuild',
      kind: 'library',
      runtime: 'universal',
      minimumVersion: '18',
      manifest: { peerDependencies: { react: '^18.2.0 || ^19.0.0' } },
      files: { 'tsup.config.ts': "import '@toolpath/dev-config/react/library'\n" },
    })
    expect(missing.messages).toContainEqual(
      expect.stringContaining('add react-compiler-runtime@1.0.0 to its dependencies'),
    )
    const declared = issuesFor({
      adapter: 'library-esbuild',
      kind: 'library',
      runtime: 'universal',
      minimumVersion: '18',
      manifest: {
        dependencies: { 'react-compiler-runtime': '1.0.0' },
        peerDependencies: { react: '^18.2.0 || ^19.0.0' },
      },
      files: { 'tsup.config.ts': "import '@toolpath/dev-config/react/library'\n" },
    })
    expect(
      declared.messages.filter((message) => message.includes('react-compiler-runtime')),
    ).toEqual([])
    expect(declared.messages.filter((message) => message.includes('minimumVersion'))).toEqual([])
  })

  it('checks the Expo experiment and a compiler registered twice', () => {
    const { messages } = issuesFor({
      adapter: 'expo',
      runtime: 'native',
      files: {
        'app.json': '{"expo":{"name":"probe"}}\n',
        'babel.config.js':
          "module.exports = { presets: ['babel-preset-expo'], plugins: ['babel-plugin-react-compiler'] }\n",
      },
    })
    expect(messages).toContainEqual(
      expect.stringContaining('app.json: does not enable experiments.reactCompiler'),
    )
    expect(messages).toContainEqual(
      expect.stringContaining('babel.config.js: names babel-plugin-react-compiler directly'),
    )
    expect(messages).toContainEqual(expect.stringContaining('needs the expo package installed'))
    const enabled = issuesFor({
      adapter: 'expo',
      runtime: 'native',
      files: {
        'app.json': '{"expo":{"experiments":{"reactCompiler":true}}}\n',
        'babel.config.js':
          "const { createExpoBabelConfig } = require('@toolpath/dev-config/react/expo')\n",
      },
    })
    expect(
      enabled.messages.filter(
        (message) => message.includes('reactCompiler') || message.includes('directly'),
      ),
    ).toEqual([])
  })
})

describe('lowestMajor', () => {
  it('reads the lower bound of common ranges', () => {
    expect(lowestMajor('^18.2.0 || ^19.0.0')).toBe(18)
    expect(lowestMajor('>=17')).toBe(17)
    expect(lowestMajor('19.x')).toBe(19)
    expect(lowestMajor('>=16.8.0 <20')).toBe(16)
    expect(lowestMajor('workspace:*')).toBeUndefined()
  })
})
