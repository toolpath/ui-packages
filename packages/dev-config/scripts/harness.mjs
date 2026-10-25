// Shared machinery for the packed-package, compatibility and benchmark
// harnesses: disposable consumers outside the monorepo, installed from the
// packed tarball with the native package manager.
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildInputsHash } from './build-inputs.mjs'

export const packageRoot = fileURLToPath(new URL('..', import.meta.url))
export const fixturesRoot = join(packageRoot, 'fixtures/generic')

/** @typedef {{ code: number | null, stdout: string, stderr: string, output: string }} ExecResult */

/**
 * Reads a JSON file as the type the caller declares; the value is unchecked.
 * @template T
 * @param {string} path
 * @returns {T}
 */
export const readJson = (path) => {
  /** @type {unknown} */
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  return /** @type {T} */ (parsed)
}

/**
 * The environment for child tools: this Node first on PATH, no inherited npm/pnpm
 * configuration from the script that launched us, hooks enabled.
 * @param {Record<string, string>} [extra]
 * @returns {NodeJS.ProcessEnv}
 */
export const childEnv = (extra = {}) => {
  /** @type {NodeJS.ProcessEnv} */
  const env = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(npm_|pnpm_|PNPM_|INIT_CWD$|HUSKY$)/i.test(key)) {
      continue
    }
    env[key] = value
  }
  env.PATH = `${dirname(process.execPath)}:${process.env.PATH ?? ''}`
  env.ASDF_NODEJS_VERSION = process.versions.node
  env.NO_UPDATE_NOTIFIER = '1'
  env.npm_config_fund = 'false'
  env.npm_config_audit = 'false'
  env.npm_config_update_notifier = 'false'
  return { ...env, ...extra }
}

/**
 * Runs a command without a shell.
 * @param {string} command
 * @param {Array<string>} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv, input?: string }} options
 * @returns {ExecResult}
 */
export const exec = (command, args, { cwd, env = childEnv(), input }) => {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...(input === undefined ? {} : { input }),
  })
  if (result.error) {
    throw result.error
  }
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: `${result.stdout}${result.stderr}`,
  }
}

/**
 * Like `exec`, but fails with the command's output unless it exits as expected.
 * @param {string} command
 * @param {Array<string>} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv, expect?: number, input?: string }} options
 * @returns {ExecResult}
 */
export const must = (command, args, { expect = 0, ...options }) => {
  const result = exec(command, args, options)
  if (result.code !== expect) {
    throw new Error(
      `${command} ${args.join(' ')} (in ${options.cwd}) exited ${String(result.code)}, expected ${expect}:\n${result.output.slice(-6000)}`,
    )
  }
  return result
}

/** A directory for this run's disposable consumers, outside any repository. */
export const createWorkRoot = () =>
  realpathSync(mkdtempSync(join(tmpdir(), 'toolpath-dev-harness-')))

/**
 * Packs the package with pnpm (which rewrites any workspace protocol) once per
 * build, and returns the tarball path.
 * @param {string} destination
 * @returns {string}
 */
export const packTarball = (destination) => {
  const stamp = buildInputsHash(packageRoot).slice(0, 12)
  const target = join(destination, `toolpath-dev-config-${stamp}.tgz`)
  if (existsSync(target)) {
    return target
  }
  mkdirSync(destination, { recursive: true })
  const packed = must('pnpm', ['pack', '--pack-destination', destination], { cwd: packageRoot })
  const produced = packed.stdout
    .trim()
    .split('\n')
    .filter((line) => line.endsWith('.tgz'))
    .at(-1)
  if (!produced) {
    throw new Error(`pnpm pack printed no tarball:\n${packed.output}`)
  }
  const source = produced.startsWith('/') ? produced : join(destination, produced)
  cpSync(source, target)
  rmSync(source)
  return target
}

/**
 * Lists a tarball's files (paths without the leading `package/`).
 * @param {string} tarball
 * @returns {Array<string>}
 */
export const tarballFiles = (tarball) =>
  must('tar', ['-tzf', tarball], { cwd: dirname(tarball) })
    .stdout.split('\n')
    .filter((line) => line !== '' && !line.endsWith('/'))
    .map((line) => line.replace(/^package\//, ''))
    .sort()

/**
 * Copies a fixture template (`node`, `react`) into `target`, dropping `.tmpl`.
 * @param {string} template
 * @param {string} target
 */
export const materialize = (template, target) => {
  const source = join(fixturesRoot, template)
  /** @param {string} directory */
  const copy = (directory) => {
    for (const entry of readdirSync(join(source, directory))) {
      const path = directory === '' ? entry : `${directory}/${entry}`
      if (statSync(join(source, path)).isDirectory()) {
        copy(path)
        continue
      }
      const destination = join(target, path.replace(/\.tmpl$/, ''))
      mkdirSync(dirname(destination), { recursive: true })
      cpSync(join(source, path), destination)
    }
  }
  copy('')
}

/**
 * Writes files relative to `root`.
 * @param {string} root
 * @param {Record<string, string>} files
 */
export const writeFiles = (root, files) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
}

/**
 * Starts a Git repository with a committer identity local to it.
 * @param {string} root
 */
export const gitInit = (root) => {
  must('git', ['init', '--quiet', '--initial-branch=main'], { cwd: root })
  must('git', ['config', 'user.name', 'Harness'], { cwd: root })
  must('git', ['config', 'user.email', 'harness@example.invalid'], { cwd: root })
  must('git', ['config', 'commit.gpgsign', 'false'], { cwd: root })
}

/** A fixed, syntactically valid source revision for fixture release identities. */
export const FIXTURE_SHA = '0123456789abcdef0123456789abcdef01234567'

/**
 * Rewrites the installed package's release identity to a fixture release. Only
 * these disposable consumers ever see it: a development build is otherwise
 * refused by `init` and `sync`, as it must be for real repositories.
 * @param {string} consumerRoot
 * @param {string} [sha]
 */
export const useFixtureRelease = (consumerRoot, sha = FIXTURE_SHA) => {
  const file = realpathSync(
    join(consumerRoot, 'node_modules/@toolpath/dev-config/dist/release.json'),
  )
  /** @type {{ repository: string, channel: string, sourceSha: string | null, dirty: boolean, workflow: string, actions: Record<string, string> }} */
  const identity = readJson(file)
  const retarget = (/** @type {string} */ ref) => ref.replace(/@[^@]+$/, `@${sha}`)
  identity.channel = 'release'
  identity.sourceSha = sha
  identity.dirty = false
  identity.workflow = retarget(identity.workflow)
  identity.actions = Object.fromEntries(
    Object.entries(identity.actions).map(([key, ref]) => [key, retarget(ref)]),
  )
  writeFileSync(file, `${JSON.stringify(identity, null, 2)}\n`)
}

/**
 * A minimal `package.json` for a disposable consumer.
 * @param {string} root
 * @param {Record<string, unknown>} fields
 */
export const writeManifest = (root, fields) => {
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture-consumer', version: '0.0.0', private: true, type: 'module', ...fields }, null, 2)}\n`,
  )
}

/**
 * Paths relative to `root`, for messages.
 * @param {string} root
 * @param {string} path
 */
export const show = (root, path) => relative(root, path) || '.'

/**
 * Times a step and returns its result and duration.
 * @template T
 * @param {() => T} step
 * @returns {{ value: T, ms: number }}
 */
export const timed = (step) => {
  const started = performance.now()
  const value = step()
  return { value, ms: performance.now() - started }
}
