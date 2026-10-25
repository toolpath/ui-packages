// The setup action's bootstrap: runtime and package manager from the committed
// toolchain manifest, a dependency-store cache key, the frozen install, browser
// installation for suites that declare it, and the core diagnosis. It reads
// only action-relative files before the install and runs the consumer's own
// `toolpath-dev` afterwards.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { parseJson } from '../result-policy.mjs'
import { error, input, setOutput } from './runtime.mjs'

/** @typedef {{ runtime: { node: string, pnpm: string, npm: string } }} Toolchain */

const BROWSERS = new Set(['chromium', 'firefox', 'webkit'])

/**
 * @param {string | URL} file
 * @returns {unknown}
 */
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

/** @returns {Toolchain} */
export const readToolchain = () =>
  /** @type {Toolchain} */ (readJson(new URL('../../policy/toolchain.json', import.meta.url)))

/**
 * The consumer directory an input names, inside the workspace.
 * @param {string} value
 * @param {string} workspace
 */
export const resolveWorkingDirectory = (value, workspace) => {
  const directory = resolve(workspace, value === '' ? '.' : value)
  if (!existsSync(join(directory, 'package.json'))) {
    throw new Error(`working-directory ${value || '.'} has no package.json`)
  }
  return directory
}

/**
 * The package manager a consumer declares, checked against the tested
 * toolchain. Conflicting metadata stops CI with the same choice `doctor` asks
 * for; nothing is guessed.
 * @param {string} directory
 * @param {Toolchain} toolchain
 * @returns {{ name: 'npm' | 'pnpm', version: string, lockfile: string }}
 */
export const resolvePackageManager = (directory, toolchain) => {
  const manifest = /** @type {{ packageManager?: unknown }} */ (
    readJson(join(directory, 'package.json'))
  )
  const pnpmLock = existsSync(join(directory, 'pnpm-lock.yaml'))
  const npmLock = ['package-lock.json', 'npm-shrinkwrap.json'].find((file) =>
    existsSync(join(directory, file)),
  )
  const declared =
    typeof manifest.packageManager === 'string'
      ? /^(npm|pnpm)@([^+\s]+)/.exec(manifest.packageManager)
      : null
  if (typeof manifest.packageManager === 'string' && !declared) {
    throw new Error(`packageManager "${manifest.packageManager}" is not npm or pnpm`)
  }
  const name = declared
    ? /** @type {'npm' | 'pnpm'} */ (declared[1])
    : pnpmLock && !npmLock
      ? 'pnpm'
      : npmLock && !pnpmLock
        ? 'npm'
        : undefined
  if (!name) {
    throw new Error(
      pnpmLock && npmLock
        ? 'Both pnpm-lock.yaml and an npm lockfile are present. Declare packageManager in package.json and remove the other lockfile.'
        : 'No lockfile is committed. CI installs with a frozen lockfile; commit pnpm-lock.yaml or package-lock.json.',
    )
  }
  const lockfile = name === 'pnpm' ? (pnpmLock ? 'pnpm-lock.yaml' : undefined) : npmLock
  if (!lockfile) {
    throw new Error(`packageManager is ${name}, but its lockfile is not committed`)
  }
  if ((name === 'pnpm' && npmLock) || (name === 'npm' && pnpmLock)) {
    throw new Error(
      `packageManager is ${name}, but the other package manager's lockfile is also present; remove it`,
    )
  }
  const tested = name === 'pnpm' ? toolchain.runtime.pnpm : toolchain.runtime.npm
  const version = declared?.[2] ?? tested
  const sameLine =
    name === 'pnpm' ? version.split('.')[0] === tested.split('.')[0] : version === tested
  if (!sameLine) {
    throw new Error(
      `packageManager declares ${name}@${version}; this @toolpath/dev-config release is tested with ${name}@${tested}. Run \`toolpath-dev sync\`.`,
    )
  }
  return { name, version, lockfile }
}

/**
 * Browsers to install, validated: only Playwright's names, each once.
 * @param {string} value
 */
export const parseBrowsers = (value) => {
  const browsers = value.split(/[\s,]+/).filter((entry) => entry !== '')
  for (const browser of browsers) {
    if (!BROWSERS.has(browser)) {
      throw new Error(`browsers: "${browser}" is not chromium, firefox or webkit`)
    }
  }
  return [...new Set(browsers)]
}

/**
 * A relative `config` path inside the consumer, or nothing.
 * @param {string} value
 */
export const parseConfigPath = (value) => {
  if (value === '') {
    return undefined
  }
  if (isAbsolute(value) || value.split(/[\\/]/).includes('..') || /[\0\n\r]/.test(value)) {
    throw new Error(`config must be a path inside the working directory, not "${value}"`)
  }
  return value
}

/**
 * The dependency-store cache key: OS, Node, package manager version, and the
 * lockfile's own hash. Computed here rather than with `hashFiles`, which only
 * sees files inside the workspace.
 * @param {{ os: string, arch: string, node: string, packageManager: string, version: string, lockfile: string }} parts
 */
export const cacheKey = ({ os, arch, node, packageManager, version, lockfile }) => {
  const prefix = `toolpath-dev-${os}-${arch}-node${node}-${packageManager}${version}-`
  return {
    key: `${prefix}${createHash('sha256').update(readFileSync(lockfile)).digest('hex')}`,
    prefix,
  }
}

/**
 * @param {string} command
 * @param {Array<string>} args
 * @param {string} cwd
 * @param {NodeJS.ProcessEnv} [environment]
 */
const run = (command, args, cwd, environment = process.env) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: environment })
  if (result.error) {
    throw new Error(`could not start ${command}: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(
      `${[command, ...args].join(' ')} exited with ${result.status ?? result.signal ?? 'an unknown status'}`,
    )
  }
}

/**
 * The consumer's installed `toolpath-dev`, found the way Node resolves the package.
 * @param {string} directory
 */
export const locateCli = (directory) => {
  let current = directory
  for (;;) {
    const candidate = join(
      current,
      'node_modules',
      '@toolpath',
      'dev-config',
      'dist',
      'cli',
      'main.js',
    )
    if (existsSync(candidate)) {
      return candidate
    }
    const parent = resolve(current, '..')
    if (parent === current) {
      throw new Error(
        '@toolpath/dev-config is not installed in the working directory; add it as an exact dev dependency',
      )
    }
    current = parent
  }
}

/**
 * The consumer's installed `@playwright/test` version, for the browser cache key.
 * @param {string} directory
 */
export const playwrightVersion = (directory) => {
  let current = directory
  for (;;) {
    const candidate = join(current, 'node_modules', '@playwright', 'test', 'package.json')
    if (existsSync(candidate)) {
      const manifest = /** @type {{ version: string }} */ (readJson(candidate))
      return manifest.version
    }
    const parent = resolve(current, '..')
    if (parent === current) {
      throw new Error('A suite declares browsers, but @playwright/test is not installed')
    }
    current = parent
  }
}

const commands = {
  /** Validates inputs and publishes what the following steps need. */
  resolve: () => {
    const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd()
    const directory = resolveWorkingDirectory(input('working-directory'), workspace)
    const toolchain = readToolchain()
    const manager = resolvePackageManager(directory, toolchain)
    const browsers = parseBrowsers(input('browsers'))
    const config = parseConfigPath(input('config'))
    const { key, prefix } = cacheKey({
      os: process.env.RUNNER_OS ?? process.platform,
      arch: process.env.RUNNER_ARCH ?? process.arch,
      node: toolchain.runtime.node,
      packageManager: manager.name,
      version: manager.version,
      lockfile: join(directory, manager.lockfile),
    })
    const fromWorkspace = relative(workspace, directory) || '.'
    setOutput('directory', directory)
    setOutput('package-json', relative(workspace, join(directory, 'package.json')))
    setOutput(
      'call',
      createHash('sha256')
        .update(`${fromWorkspace}\0${config ?? ''}`)
        .digest('hex')
        .slice(0, 12),
    )
    setOutput('node-version', toolchain.runtime.node)
    setOutput('package-manager', manager.name)
    setOutput('pnpm-version', manager.name === 'pnpm' ? manager.version : '')
    setOutput('npm-version', manager.name === 'npm' ? manager.version : '')
    setOutput('cache-key', key)
    setOutput('cache-prefix', prefix)
    setOutput('browsers', browsers.join(' '))
    setOutput('config', config ?? '')
    process.stdout.write(
      `dev-config setup: ${fromWorkspace} with Node ${toolchain.runtime.node} and ${manager.name}@${manager.version}\n`,
    )
  },
  /** The package manager's store, which the cache saves (never node_modules). */
  store: () => {
    const directory = resolve(input('directory'))
    const manager = input('package-manager')
    const result =
      manager === 'pnpm'
        ? spawnSync('pnpm', ['store', 'path', '--silent'], { cwd: directory, encoding: 'utf8' })
        : spawnSync('npm', ['config', 'get', 'cache'], { cwd: directory, encoding: 'utf8' })
    if (result.status !== 0 || result.stdout.trim() === '') {
      throw new Error(`could not read the ${manager} store path: ${result.stderr.trim()}`)
    }
    setOutput('path', result.stdout.trim())
  },
  /** The frozen install. Hooks are not installed in CI; checks still run. */
  install: () => {
    const directory = resolve(input('directory'))
    const manager = input('package-manager')
    const environment = { ...process.env, HUSKY: '0', CI: 'true' }
    if (manager === 'pnpm') {
      run('pnpm', ['install', '--frozen-lockfile'], directory, environment)
    } else {
      run('npm', ['ci'], directory, environment)
    }
  },
  /** The exact Playwright identity for the browser cache key. */
  'browser-identity': () => {
    setOutput('playwright', playwrightVersion(resolve(input('directory'))))
  },
  /** Installs the declared browsers (and their system packages) explicitly. */
  browsers: () => {
    const directory = resolve(input('directory'))
    const browsers = parseBrowsers(input('browsers'))
    if (browsers.length === 0) {
      return
    }
    let current = directory
    let cli
    for (;;) {
      const candidate = join(current, 'node_modules', '@playwright', 'test', 'cli.js')
      if (existsSync(candidate)) {
        cli = candidate
        break
      }
      const parent = resolve(current, '..')
      if (parent === current) {
        throw new Error('A suite declares browsers, but @playwright/test is not installed')
      }
      current = parent
    }
    run(process.execPath, [cli, 'install', '--with-deps', ...browsers], directory)
  },
  /** `doctor`, then the execution plan the reusable workflow schedules. */
  diagnose: () => {
    const directory = resolve(input('directory'))
    const config = parseConfigPath(input('config'))
    const cli = locateCli(directory)
    const configArgs = config === undefined ? [] : ['--config', config]
    run(process.execPath, [cli, 'doctor', ...configArgs], directory)
    const planned = spawnSync(process.execPath, [cli, 'ci', '--plan', ...configArgs], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    if (planned.status !== 0) {
      throw new Error('toolpath-dev ci --plan failed')
    }
    const parsed = parseJson(planned.stdout)
    if (!parsed.ok) {
      throw new Error(`toolpath-dev ci --plan printed no plan: it ${parsed.error}`)
    }
    const plan =
      /** @type {{ suites: Array<{ suite: string, key: string, browsers: Array<string>, timeoutMinutes: number }> }} */ (
        parsed.value
      )
    const matrix = plan.suites.map((entry) => ({
      suite: entry.suite,
      key: entry.key,
      browsers: entry.browsers.join(' '),
      timeout: entry.timeoutMinutes,
    }))
    setOutput('plan', JSON.stringify(plan))
    setOutput('suites', JSON.stringify(matrix))
    setOutput('has-suites', matrix.length > 0 ? 'true' : 'false')
  },
}

/** @param {string | undefined} name */
export const main = (name) => {
  const command =
    name === undefined ? undefined : Object.entries(commands).find(([key]) => key === name)?.[1]
  if (!command) {
    error(`dev-config-setup: unknown step "${String(name)}"`)
    process.exitCode = 2
    return
  }
  try {
    command()
  } catch (failure) {
    error(`dev-config-setup: ${failure instanceof Error ? failure.message : String(failure)}`)
    process.exitCode = 1
  }
}
