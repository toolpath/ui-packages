// The React compatibility matrix: disposable consumers outside the monorepo,
// each installed from the packed @toolpath/dev-config tarball plus the exact
// registry versions an adapter is tested with, and each exercised through its
// own real build. One prepared environment per adapter serves every check that
// needs it (and is reused by a later run in a kept work directory while its
// inputs are unchanged); all of them install through npm's one shared cache.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import toolchain from '../../src/policy/toolchain.json' with { type: 'json' }

/**
 * @typedef {'passed' | 'failed' | 'prerequisite'} CompatibilityStatus
 * @typedef {{ name: string, status: CompatibilityStatus, durationMs: number, detail: string }} CompatibilityResult
 * @typedef {{ code: number | null, stdout: string, stderr: string }} Execution
 * @typedef {{ tarball: string, workDir: string, log?: (text: string) => void }} CompatibilityOptions
 */

/** Versions the matrix needs that the release does not manage (applications own them). */
const HARNESS_VERSIONS = {
  react17: '17.0.2',
  react18: '18.3.1',
  reactRouterNode: '7.18.4',
  isbot: '5.2.2',
  testRenderer: '1.3.0',
  reactNativeJestPreset: '0.88.0',
  typesReact: '19.3.0',
}

const profile = /** @param {string} name @returns {Record<string, string>} */ (name) => {
  /** @type {Record<string, string | Array<string>>} */
  const entries = toolchain.profiles[/** @type {keyof typeof toolchain.profiles} */ (name)]
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, [value].flat()[0] ?? '']),
  )
}

const testedVersion = /** @param {string} name @returns {string} */ (name) => {
  /** @type {Record<string, string>} */
  const tested = toolchain.tested
  const version = tested[name]
  if (version === undefined) {
    throw new Error(`toolchain.json records no tested version of ${name}`)
  }
  return version
}

/** Dev dependencies every consumer gets: the package under test and its required peers. */
const baseDevDependencies = /** @param {string} tarball @returns {Record<string, string>} */ (
  tarball,
) => ({
  '@toolpath/dev-config': `file:${tarball}`,
  eslint: toolchain.core.eslint,
  typescript: toolchain.core.defaultTypescript,
})

/**
 * Runs a command without a shell. Node's own directory leads PATH, so `npm`
 * is the npm of the Node running the matrix, whatever version manager is installed.
 * @param {string} cwd
 * @param {string} command
 * @param {Array<string>} args
 * @param {{ env?: Record<string, string>, input?: string, timeoutMs?: number }} [options]
 * @returns {Promise<Execution>}
 */
const execute = (cwd, command, args, options = {}) =>
  new Promise((resolveExecution, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`,
        ...options.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (/** @type {string} */ chunk) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (/** @type {string} */ chunk) => {
      stderr += chunk
    })
    const timer = setTimeout(() => {
      stderr += `\nTimed out after ${String(Math.round((options.timeoutMs ?? 600_000) / 1000))}s\n`
      child.kill('SIGTERM')
    }, options.timeoutMs ?? 600_000)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolveExecution({ code, stdout, stderr })
    })
    child.stdin.end(options.input ?? '')
  })

/**
 * @param {Record<string, string>} files
 * @param {string} directory
 */
const writeFiles = (directory, files) => {
  for (const [path, content] of Object.entries(files)) {
    const target = join(directory, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
}

/** The start and end of a long log: where an error is named and where it ended. @param {Execution} execution @returns {string} */
const tail = (execution) => {
  const lines = `${execution.stdout}\n${execution.stderr}`.trim().split('\n')
  return lines.length <= 50
    ? lines.join('\n')
    : [...lines.slice(0, 20), '…', ...lines.slice(-30)].join('\n')
}

class StepFailure extends Error {
  /** @param {string} message @param {CompatibilityStatus} [status] */
  constructor(message, status = 'failed') {
    super(message)
    this.name = 'StepFailure'
    this.status = status
  }
}

/**
 * @param {Execution} execution
 * @param {string} what
 */
const expectSuccess = (execution, what) => {
  if (execution.code !== 0) {
    // toolpath-dev exits 2 for a missing prerequisite (such as an absent browser); an
    // unexpected error also exits 2 but is a defect.
    const prerequisite =
      execution.code === 2 && !`${execution.stdout}${execution.stderr}`.includes('unexpected error')
    throw new StepFailure(
      `${what} exited with ${String(execution.code)}:\n${tail(execution)}`,
      prerequisite ? 'prerequisite' : 'failed',
    )
  }
}

/**
 * An installed npm consumer, reused while its manifest and the tarball are unchanged.
 * @param {{ workDir: string, tarball: string, log: (text: string) => void }} context
 * @param {string} name
 * @param {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string>, extra?: Record<string, unknown> }} manifest
 * @returns {Promise<string>}
 */
const prepare = async (context, name, manifest) => {
  const directory = join(context.workDir, name)
  const packageJson = {
    name: `compat-${name}`,
    version: '1.0.0',
    private: true,
    type: 'module',
    ...manifest.extra,
    dependencies: manifest.dependencies ?? {},
    devDependencies: manifest.devDependencies ?? {},
  }
  // Every installed tarball's bytes are part of the identity, so a rebuilt library reinstalls.
  const hash = createHash('sha256').update(JSON.stringify(packageJson))
  for (const spec of [
    ...Object.values(packageJson.dependencies),
    ...Object.values(packageJson.devDependencies),
  ]) {
    if (spec.startsWith('file:') && spec.endsWith('.tgz') && existsSync(spec.slice(5))) {
      hash.update(readFileSync(spec.slice(5)))
    }
  }
  const identity = hash.digest('hex')
  const marker = join(directory, '.prepared')
  if (existsSync(marker) && readFileSync(marker, 'utf8') === identity) {
    return directory
  }
  rmSync(directory, { recursive: true, force: true })
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)
  const install = await execute(
    directory,
    'npm',
    ['install', '--no-audit', '--no-fund', '--loglevel=error'],
    {
      env: { npm_config_update_notifier: 'false' },
    },
  )
  expectSuccess(install, `npm install in ${name}`)
  writeFileSync(marker, identity)
  return directory
}

/** The toolpath-dev CLI as installed in a consumer. */
const cli = /** @param {string} directory */ (directory) =>
  join(directory, 'node_modules/@toolpath/dev-config/dist/cli/main.js')

/** @param {string} directory @param {string} file */
const inspect = (directory, file) => execute(directory, process.execPath, ['inspect.mjs', file])

const INSPECT = `// Exits 0 when the file holds React Compiler output (or, with --uncompiled, when it does not).
import { readFileSync } from 'node:fs'
import { inspectBuiltArtifact } from '@toolpath/dev-config/react/library'

const [file, mode] = process.argv.slice(2)
const evidence = inspectBuiltArtifact(readFileSync(file, 'utf8'))
process.stdout.write(JSON.stringify(evidence) + '\\n')
process.exit(evidence.compiled === (mode !== '--uncompiled') ? 0 : 1)
`

const COUNTER = `import { useState } from 'react'

export const Counter = ({ label }: { label: string }) => {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {label}: {count}
    </button>
  )
}
`

/**
 * @param {{ name: string, root?: string, kind?: string, runtime: string, react?: Record<string, string>, suites?: Record<string, unknown>, noUnitTests?: boolean }} project
 * @returns {string}
 */
const devConfig = (project) => {
  const declared = {
    name: project.name,
    root: project.root ?? '.',
    kind: project.kind ?? 'application',
    runtime: project.runtime,
    tsconfig: 'tsconfig.json',
    ...(project.react ? { react: project.react } : {}),
    ...(project.suites ? { suites: project.suites } : {}),
    ...(project.noUnitTests
      ? { noUnitTests: { reason: 'A compatibility consumer; its build is what is under test' } }
      : {}),
  }
  return `import { defineConfig } from '@toolpath/dev-config'

export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [${JSON.stringify(declared)}],
  ci: { node: '${toolchain.runtime.node}' },
})
`
}

const BROWSER_TSCONFIG = `{
  "extends": "@toolpath/dev-config/typescript/browser.json",
  "include": ["src", "app", "tests"]
}
`

/** @typedef {{ workDir: string, tarball: string, log: (text: string) => void }} Context */

/**
 * A Vite application on one adapter: React Compiler verified through the real
 * config, and a production library build whose artifact holds compiled code.
 * @param {Context} context
 * @param {'vite-legacy' | 'vite-modern'} adapter
 * @param {boolean} browser
 * @returns {Promise<string>}
 */
const viteApplication = async (context, adapter, browser) => {
  const directory = await prepare(context, adapter, {
    dependencies: { react: testedVersion('react'), 'react-dom': testedVersion('react-dom') },
    devDependencies: {
      ...baseDevDependencies(context.tarball),
      ...profile('react'),
      ...profile(`react-${adapter}`),
      ...(browser ? profile('playwright') : {}),
    },
  })
  // Each Vite config imports the adapter itself: doctor reads the config file for that import.
  const imports = `import config from './dev.config.mjs'
import { createReactPlugins } from '@toolpath/dev-config/react/vite'
`
  writeFiles(directory, {
    'dev.config.mjs': devConfig({
      name: 'app',
      runtime: 'dom',
      react: { adapter },
      noUnitTests: true,
      ...(browser
        ? {
            suites: {
              unit: {
                runner: 'command',
                argv: ['node', 'unit.mjs'],
                report: { format: 'junit', path: 'unit.xml' },
              },
              browser: { runner: 'playwright', config: 'playwright.config.mjs' },
            },
          }
        : {}),
    }),
    'tsconfig.json': BROWSER_TSCONFIG,
    'vite.config.mjs': `${imports}\nexport default { plugins: await createReactPlugins(config, { project: 'app' }) }\n`,
    'vite.lib.config.mjs': `${imports}
export default {
  plugins: await createReactPlugins(config, { project: 'app' }),
  build: {
    outDir: 'dist-lib',
    lib: { entry: 'src/Counter.tsx', formats: ['es'], fileName: 'counter' },
    ${adapter === 'vite-modern' ? 'rolldownOptions' : 'rollupOptions'}: { external: [/^react(\\/|$)/] },
  },
}
`,
    'index.html':
      '<!doctype html>\n<html lang="en"><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
    'src/Counter.tsx': COUNTER,
    'src/main.tsx': `import { createRoot } from 'react-dom/client'
import { Counter } from './Counter'

const root = document.getElementById('root')
if (root) createRoot(root).render(<Counter label="Count" />)
`,
    'inspect.mjs': INSPECT,
    ...(browser
      ? {
          // A command suite with a JUnit report: the matrix's proof that such suites are counted.
          'unit.mjs': `import { writeFileSync } from 'node:fs'
writeFileSync('unit.xml', '<testsuites><testsuite name="unit" tests="1" failures="0" errors="0" skipped="0"><testcase name="runs"/></testsuite></testsuites>')
`,
          'playwright.config.mjs': `import config from './dev.config.mjs'
import { createPlaywrightConfig } from '@toolpath/dev-config/playwright'

export default createPlaywrightConfig(config, {
  project: 'app',
  suite: 'browser',
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4319 --strictPort', url: 'http://127.0.0.1:4319' },
})
`,
          'tests/counter.spec.mjs': `import { expect, test } from '@playwright/test'

test('counts presses in a real browser', async ({ page }) => {
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Count: 0' })
  await button.click()
  await expect(page.getByRole('button')).toHaveText('Count: 1')
})
`,
        }
      : {}),
  })
  expectSuccess(
    await execute(directory, process.execPath, [cli(directory), 'react', 'verify']),
    `${adapter}: toolpath-dev react verify`,
  )
  expectSuccess(
    await execute(directory, process.execPath, [
      'node_modules/vite/bin/vite.js',
      'build',
      '--config',
      'vite.lib.config.mjs',
      '--logLevel',
      'error',
    ]),
    `${adapter}: vite build (library mode)`,
  )
  expectSuccess(
    await inspect(directory, 'dist-lib/counter.js'),
    `${adapter}: compiled output in the production build`,
  )
  if (!browser) {
    return `${adapter}: react verify and a production build compile the component`
  }
  expectSuccess(
    await execute(directory, process.execPath, [
      'node_modules/vite/bin/vite.js',
      'build',
      '--logLevel',
      'error',
    ]),
    `${adapter}: vite build (application)`,
  )
  expectSuccess(
    await execute(directory, process.execPath, [cli(directory), 'test', '--suite', 'app:unit']),
    `${adapter}: command suite`,
  )
  expectSuccess(
    await execute(directory, process.execPath, [cli(directory), 'test', '--suite', 'app:browser'], {
      timeoutMs: 180_000,
    }),
    `${adapter}: Playwright browser suite`,
  )
  return `${adapter}: react verify, production build, a JUnit command suite, and a Chromium test of the compiled app`
}

/**
 * React Router 7 through vite-plugin-babel: verified dev transform, and an SSR
 * build whose server bundle (React external) holds compiled route code.
 * @param {Context} context
 * @returns {Promise<string>}
 */
const reactRouterApplication = async (context) => {
  const directory = await prepare(context, 'react-router', {
    dependencies: {
      react: testedVersion('react'),
      'react-dom': testedVersion('react-dom'),
      'react-router': testedVersion('react-router'),
      '@react-router/node': HARNESS_VERSIONS.reactRouterNode,
      isbot: HARNESS_VERSIONS.isbot,
    },
    devDependencies: {
      ...baseDevDependencies(context.tarball),
      ...profile('react'),
      ...profile('react-react-router'),
      '@react-router/dev': testedVersion('@react-router/dev'),
      vite: profile('react-vite-legacy').vite ?? '',
    },
  })
  writeFiles(directory, {
    'dev.config.mjs': devConfig({
      name: 'app',
      runtime: 'dom',
      react: { adapter: 'react-router' },
      noUnitTests: true,
    }),
    'tsconfig.json': BROWSER_TSCONFIG,
    'react-router.config.ts': 'export default { ssr: true }\n',
    'vite.config.mjs': `import { reactRouter } from '@react-router/dev/vite'
import config from './dev.config.mjs'
import { createReactRouterCompilerPlugin } from '@toolpath/dev-config/react/babel'

export default { plugins: [reactRouter(), await createReactRouterCompilerPlugin(config, { project: 'app' })] }
`,
    'app/root.tsx': `import { Links, Meta, Outlet, Scripts } from 'react-router'

export default function Root() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
`,
    'app/routes.ts':
      "import { index, type RouteConfig } from '@react-router/dev/routes'\n\nexport default [index('routes/home.tsx')] satisfies RouteConfig\n",
    'app/routes/home.tsx': `${COUNTER}\nexport default function Home() {\n  return <Counter label="Count" />\n}\n`,
    'inspect.mjs': INSPECT,
  })
  expectSuccess(
    await execute(directory, process.execPath, [cli(directory), 'react', 'verify']),
    'react-router: toolpath-dev react verify',
  )
  expectSuccess(
    await execute(directory, process.execPath, ['node_modules/@react-router/dev/bin.js', 'build']),
    'react-router: react-router build',
  )
  expectSuccess(
    await inspect(directory, 'build/server/index.js'),
    'react-router: compiled route code in the server build',
  )
  return 'react-router: react verify and an SSR build with compiled route modules'
}

/**
 * Expo SDK 58: the Metro-style transform compiles through babel-preset-expo's
 * experiment, and a native component test runs under jest-expo.
 * @param {Context} context
 * @returns {Promise<string>}
 */
const expoApplication = async (context) => {
  const directory = await prepare(context, 'expo', {
    dependencies: {
      expo: testedVersion('expo'),
      react: testedVersion('react'),
      'react-native': testedVersion('react-native'),
    },
    devDependencies: {
      ...baseDevDependencies(context.tarball),
      ...profile('react'),
      ...profile('jest-expo'),
      '@babel/core': profile('react-babel')['@babel/core'] ?? '',
      '@react-native/jest-preset': HARNESS_VERSIONS.reactNativeJestPreset,
      'test-renderer': HARNESS_VERSIONS.testRenderer,
    },
  })
  writeFiles(directory, {
    'dev.config.mjs': devConfig({
      name: 'mobile',
      runtime: 'native',
      react: { adapter: 'expo' },
      suites: { unit: { runner: 'jest-expo', config: 'jest.config.mjs' } },
    }),
    'tsconfig.json':
      '{\n  "extends": "@toolpath/dev-config/typescript/base.json",\n  "compilerOptions": { "jsx": "react-jsx" },\n  "include": ["src"]\n}\n',
    'app.json': JSON.stringify(
      { expo: { name: 'compat', slug: 'compat', experiments: { reactCompiler: true } } },
      null,
      2,
    ),
    // CommonJS, as Metro loads it: Node 24 requires the package's ESM build directly.
    'babel.config.cjs': `const { createExpoBabelConfig } = require('@toolpath/dev-config/react/expo')
const { default: config } = require('./dev.config.mjs')

module.exports = (api) => {
  api.cache(true)
  return createExpoBabelConfig(config, { project: 'mobile' })
}
`,
    'jest.config.mjs': `import config from './dev.config.mjs'
import { createJestExpoConfig } from '@toolpath/dev-config/jest-expo'

export default createJestExpoConfig(config, { project: 'mobile', suite: 'unit' })
`,
    'src/Greeting.tsx': `import { useState } from 'react'
import { Pressable, Text } from 'react-native'

export const Greeting = ({ name }: { name: string }) => {
  const [count, setCount] = useState(0)
  return (
    <Pressable accessibilityRole="button" onPress={() => setCount(count + 1)}>
      <Text>Hello {name}: {count}</Text>
    </Pressable>
  )
}
`,
    // React Native Testing Library 14 renders and presses asynchronously.
    'src/Greeting.test.tsx': `import { render, screen, userEvent } from '@testing-library/react-native'
import { Greeting } from './Greeting'

test('counts presses', async () => {
  const user = userEvent.setup()
  await render(<Greeting name="Ada" />)
  await user.press(screen.getByRole('button'))
  expect(screen.getByText('Hello Ada: 1')).toBeOnTheScreen()
})
`,
  })
  expectSuccess(
    await execute(directory, process.execPath, [cli(directory), 'react', 'verify']),
    'expo: toolpath-dev react verify',
  )
  expectSuccess(
    await execute(directory, process.execPath, [cli(directory), 'test'], { timeoutMs: 300_000 }),
    'expo: jest-expo native component test',
  )
  return 'expo: the Metro transform compiles through the experiment, and a jest-expo component test passes'
}

/**
 * A tiny React library built with tsup and the esbuild adapter: compiled web and
 * native variants, an uncompiled build of the same source, a server-safe entry,
 * and declarations from tsc. Returns its packed tarball.
 * @param {Context} context
 * @param {{ name: string, target: '17' | '19', reactPeer: string }} library
 * @returns {Promise<string>}
 */
const buildLibrary = async (context, library) => {
  const directory = await prepare(context, library.name, {
    dependencies:
      library.target === '19' ? {} : { 'react-compiler-runtime': toolchain.react.compilerRuntime },
    devDependencies: {
      ...baseDevDependencies(context.tarball),
      ...profile('react'),
      ...profile('react-library-esbuild'),
      esbuild: testedVersion('esbuild'),
      tsup: testedVersion('tsup'),
      react: testedVersion('react'),
      '@types/react': HARNESS_VERSIONS.typesReact,
    },
    extra: {
      name: library.name,
      peerDependencies: { react: library.reactPeer },
      exports: {
        '.': {
          types: './dist/types/index.d.ts',
          'react-native': './dist/native/index.js',
          default: './dist/web/index.js',
        },
        './uncompiled': { types: './dist/types/index.d.ts', default: './dist/uncompiled/index.js' },
        './server': { types: './dist/types/server.d.ts', default: './dist/server/server.js' },
      },
      files: ['dist'],
    },
  })
  const button = /** @param {string} variant */ (variant) => `import { useState } from 'react'

export const Counter = ({ label }: { label: string }) => {
  const [count, setCount] = useState(0)
  return (
    <button type="button" data-variant="${variant}" onClick={() => setCount(count + 1)}>
      {label}: {count}
    </button>
  )
}
`
  writeFiles(directory, {
    'dev.config.mjs': devConfig({
      name: 'ui',
      kind: 'library',
      runtime: 'universal',
      react: { adapter: 'library-esbuild', minimumVersion: library.target },
      noUnitTests: true,
    }),
    // Bundler resolution: platform files are imported without an extension, as Metro and esbuild resolve them.
    'tsconfig.json':
      '{\n  "extends": "@toolpath/dev-config/typescript/library.json",\n  "compilerOptions": { "module": "ESNext", "moduleResolution": "Bundler", "noEmit": false, "emitDeclarationOnly": true, "declaration": true, "outDir": "dist/types", "rootDir": "src" },\n  "include": ["src"]\n}\n',
    'tsup.config.mjs': `import config from './dev.config.mjs'
import { platformResolveExtensions, reactCompilerEsbuildPlugin } from '@toolpath/dev-config/react/library'

const compiler = reactCompilerEsbuildPlugin(config, { project: 'ui' })
const shared = { entry: ['src/index.ts'], format: ['esm'], dts: false, clean: false, external: ['react', 'react/*', 'react-native', 'react-compiler-runtime'] }
const extensions = (platform) => (options) => {
  options.resolveExtensions = platformResolveExtensions(platform)
}

export default [
  { ...shared, outDir: 'dist/web', esbuildOptions: extensions('web'), esbuildPlugins: [compiler] },
  { ...shared, outDir: 'dist/native', esbuildOptions: extensions('native'), esbuildPlugins: [compiler] },
  { ...shared, outDir: 'dist/uncompiled', esbuildOptions: extensions('web') },
  { ...shared, entry: ['src/server.ts'], outDir: 'dist/server' },
]
`,
    'src/index.ts': "export { Counter } from './Counter'\nexport { formatCount } from './server'\n",
    'src/Counter.web.tsx': button('web'),
    'src/Counter.native.tsx': button('native'),
    'src/Counter.tsx': button('shared'),
    'src/server.ts':
      'export const formatCount = (count: number): string => `${String(count)} presses`\n',
    'inspect.mjs': INSPECT,
  })
  rmSync(join(directory, 'dist'), { recursive: true, force: true })
  expectSuccess(
    await execute(directory, process.execPath, [cli(directory), 'react', 'verify']),
    `${library.name}: toolpath-dev react verify`,
  )
  expectSuccess(
    await execute(directory, process.execPath, ['node_modules/tsup/dist/cli-default.js']),
    `${library.name}: tsup build`,
  )
  expectSuccess(
    await execute(directory, process.execPath, [
      'node_modules/typescript/bin/tsc',
      '-p',
      'tsconfig.json',
    ]),
    `${library.name}: tsc declarations`,
  )
  expectSuccess(
    await inspect(directory, 'dist/web/index.js'),
    `${library.name}: compiled web build`,
  )
  expectSuccess(
    await inspect(directory, 'dist/native/index.js'),
    `${library.name}: compiled native build`,
  )
  expectSuccess(
    await execute(directory, process.execPath, [
      'inspect.mjs',
      'dist/uncompiled/index.js',
      '--uncompiled',
    ]),
    `${library.name}: the uncompiled build`,
  )
  const web = readFileSync(join(directory, 'dist/web/index.js'), 'utf8')
  const native = readFileSync(join(directory, 'dist/native/index.js'), 'utf8')
  if (!web.includes('"web"') || !native.includes('"native"')) {
    throw new StepFailure(`${library.name}: a platform build did not pick its own Counter variant`)
  }
  const runtime = library.target === '19' ? 'react/compiler-runtime' : 'react-compiler-runtime'
  if (!web.includes(runtime)) {
    throw new StepFailure(
      `${library.name}: the React ${library.target} build does not import ${runtime}`,
    )
  }
  const server = await execute(directory, process.execPath, [
    '--input-type=module',
    '-e',
    "import { formatCount } from './dist/server/server.js'; if (formatCount(2) !== '2 presses') process.exit(1)",
  ])
  expectSuccess(server, `${library.name}: the server-safe entry runs in Node without a DOM`)
  const packed = await execute(directory, 'npm', [
    'pack',
    '--silent',
    '--pack-destination',
    context.workDir,
  ])
  expectSuccess(packed, `${library.name}: npm pack`)
  const file = packed.stdout.trim().split('\n').at(-1) ?? ''
  return join(context.workDir, file)
}

/** One behaviour suite for both builds: the compiled default entry and the uncompiled one. */
const BEHAVIOUR_TEST = `import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

describe.each([
  ['compiled', () => import('LIBRARY')],
  ['uncompiled', () => import('LIBRARY/uncompiled')],
])('Counter (%s)', (_variant, load) => {
  it('counts presses', async () => {
    const { Counter } = await load()
    const user = userEvent.setup()
    render(<Counter label="Count" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('Count: 1')
  })
})
`

/**
 * Installs a packed library into a consumer and runs one behaviour suite against
 * its compiled and uncompiled builds through toolpath-dev and the Vitest factory.
 * @param {Context} context
 * @param {{ name: string, library: string, libraryTarball: string, react: string }} consumer
 * @returns {Promise<string>}
 */
const libraryConsumer = async (context, consumer) => {
  const directory = await prepare(context, consumer.name, {
    dependencies: {
      react: consumer.react,
      'react-dom': consumer.react,
      [consumer.library]: `file:${consumer.libraryTarball}`,
    },
    devDependencies: {
      ...baseDevDependencies(context.tarball),
      ...profile('vitest'),
      ...profile('dom'),
    },
  })
  writeFiles(directory, {
    'dev.config.mjs': devConfig({
      name: 'web',
      runtime: 'dom',
      suites: { unit: { runner: 'vitest', config: 'vitest.config.mjs' } },
    }),
    'tsconfig.json': BROWSER_TSCONFIG,
    'vitest.config.mjs': `import config from './dev.config.mjs'
import { createVitestConfig } from '@toolpath/dev-config/vitest'

export default createVitestConfig(config, { project: 'web', suite: 'unit' })
`,
    'src/counter.test.tsx': BEHAVIOUR_TEST.replaceAll('LIBRARY', consumer.library),
  })
  expectSuccess(
    await execute(directory, process.execPath, [cli(directory), 'test']),
    `${consumer.name}: behaviour suite on React ${consumer.react}`,
  )
  return `${consumer.name}: one suite passes for the compiled and uncompiled builds on React ${consumer.react}`
}

/**
 * React 17 predates the Testing Library release the standard pins, so this
 * consumer drives both builds with react-dom's legacy API in jsdom. React 17 has
 * no `exports` map, so `react/jsx-runtime` resolves only through a bundler, as
 * in every React 17 application; esbuild bundles the check before it runs.
 * @param {Context} context
 * @param {string} libraryTarball
 * @returns {Promise<string>}
 */
const react17Consumer = async (context, libraryTarball) => {
  const directory = await prepare(context, 'react-17-consumer', {
    dependencies: {
      react: HARNESS_VERSIONS.react17,
      'react-dom': HARNESS_VERSIONS.react17,
      'tiny-ui-legacy': `file:${libraryTarball}`,
    },
    devDependencies: { jsdom: profile('dom').jsdom ?? '', esbuild: testedVersion('esbuild') },
  })
  writeFiles(directory, {
    // Evaluated first, so react-dom sees a DOM when it initializes.
    'dom.mjs': `import { JSDOM } from 'jsdom'

const { window } = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true })
// Node 24 already defines a read-only navigator, which react-dom accepts.
Object.assign(globalThis, {
  window,
  document: window.document,
  requestAnimationFrame: window.requestAnimationFrame,
  cancelAnimationFrame: window.cancelAnimationFrame,
  IS_REACT_ACT_ENVIRONMENT: true,
})
`,
    'run.mjs': `import './dom.mjs'
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import { Counter as Compiled } from 'tiny-ui-legacy'
import { Counter as Uncompiled } from 'tiny-ui-legacy/uncompiled'

for (const [name, Counter] of [['compiled', Compiled], ['uncompiled', Uncompiled]]) {
  const root = document.getElementById('root')
  act(() => { ReactDOM.render(React.createElement(Counter, { label: 'Count' }), root) })
  act(() => { root.querySelector('button').dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  if (root.textContent !== 'Count: 1') { console.error(name, 'rendered', root.textContent); process.exit(1) }
  ReactDOM.unmountComponentAtNode(root)
}
// React 17's scheduler holds a MessageChannel port open, and jsdom's visual mode
// an animation-frame timer, so the process ends explicitly once both builds pass.
window.close()
console.log('react-17: compiled and uncompiled builds behave alike')
process.exit(0)
`,
    // esbuild's API rather than its bin, which npm replaces with a native executable.
    'bundle.mjs': `import { build } from 'esbuild'

await build({ entryPoints: ['run.mjs'], bundle: true, platform: 'node', format: 'esm', external: ['jsdom'], outfile: 'run.bundle.mjs', logLevel: 'error' })
`,
  })
  expectSuccess(
    await execute(directory, process.execPath, ['bundle.mjs']),
    'react-17-consumer: bundling the check',
  )
  expectSuccess(
    await execute(directory, process.execPath, ['run.bundle.mjs']),
    'react-17-consumer: compiled and uncompiled builds on React 17',
  )
  return 'react-17-consumer: the React 17 build with react-compiler-runtime behaves like the uncompiled one'
}

/**
 * Runs the React matrix and resolves with every combination's result once all
 * passed; otherwise it rejects, after running the rest, with one error naming
 * each combination that failed or lacked a prerequisite (an absent browser is
 * never a pass). `log` receives exactly one line per passed combination.
 * @param {CompatibilityOptions} options
 * @returns {Promise<Array<CompatibilityResult>>}
 */
export const runReactCompatibility = async ({ tarball, workDir, log = () => undefined }) => {
  mkdirSync(workDir, { recursive: true })
  /** @type {Context} */
  const context = { tarball, workDir, log }
  /** @type {Array<CompatibilityResult>} */
  const results = []
  /**
   * @param {string} name
   * @param {() => Promise<string>} body
   */
  const step = async (name, body) => {
    const started = performance.now()
    try {
      const detail = await body()
      const durationMs = Math.round(performance.now() - started)
      results.push({ name, status: 'passed', durationMs, detail })
      log(`react ${detail} (${(durationMs / 1000).toFixed(1)}s)`)
    } catch (error) {
      const status = error instanceof StepFailure ? error.status : 'failed'
      const detail = error instanceof Error ? error.message : String(error)
      results.push({ name, status, durationMs: Math.round(performance.now() - started), detail })
    }
  }

  await step('vite-legacy', () => viteApplication(context, 'vite-legacy', false))
  await step('vite-modern', () => viteApplication(context, 'vite-modern', true))
  await step('react-router', () => reactRouterApplication(context))
  await step('expo', () => expoApplication(context))

  /** @type {string | undefined} */
  let modernLibrary
  await step('library-esbuild', async () => {
    modernLibrary = await buildLibrary(context, {
      name: 'tiny-ui',
      target: '19',
      reactPeer: '^19.0.0',
    })
    return 'library-esbuild: compiled web/native builds, an uncompiled build, a server entry and declarations, packed'
  })
  await step('library-consumer-react-19', async () => {
    if (!modernLibrary) {
      throw new StepFailure('the library-esbuild step did not produce a tarball')
    }
    return libraryConsumer(context, {
      name: 'react-19-consumer',
      library: 'tiny-ui',
      libraryTarball: modernLibrary,
      react: testedVersion('react'),
    })
  })

  /** @type {string | undefined} */
  let legacyLibrary
  await step('library-esbuild-react-17-target', async () => {
    legacyLibrary = await buildLibrary(context, {
      name: 'tiny-ui-legacy',
      target: '17',
      reactPeer: '^17.0.0 || ^18.0.0 || ^19.0.0',
    })
    return 'library-esbuild-react-17-target: compiled for React 17 through react-compiler-runtime, packed'
  })
  await step('library-consumer-react-18', async () => {
    if (!legacyLibrary) {
      throw new StepFailure('the React 17 target library did not produce a tarball')
    }
    return libraryConsumer(context, {
      name: 'react-18-consumer',
      library: 'tiny-ui-legacy',
      libraryTarball: legacyLibrary,
      react: HARNESS_VERSIONS.react18,
    })
  })
  await step('library-consumer-react-17', async () => {
    if (!legacyLibrary) {
      throw new StepFailure('the React 17 target library did not produce a tarball')
    }
    return react17Consumer(context, legacyLibrary)
  })

  const unpassed = results.filter((result) => result.status !== 'passed')
  if (unpassed.length > 0) {
    throw new Error(
      `React compatibility: ${String(unpassed.length)} of ${String(results.length)} combinations did not pass:\n` +
        unpassed
          .map((result) => `\n- ${result.name} (${result.status}):\n${result.detail}`)
          .join('\n'),
    )
  }
  return results
}
