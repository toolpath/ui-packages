import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { callerWorkflowIssues, CALLER_WORKFLOW_PATH } from '../../ci/render.js'
import { findConfigFile, loadConfig } from '../../config/load.js'
import { detectPackageManager, findInstalledPackage } from '../../config/packages.js'
import { readManifest, resolveConfig, type ResolvedConfig } from '../../config/resolve.js'
import { classifyFiles } from '../../config/scope.js'
import { contractForSdkVersion } from '../../engine/contracts.js'
import { ConfigError, type Issue } from '../../errors.js'
import { toolchain } from '../../policy/toolchain.js'
import { reactAdapterIssues } from '../../react/requirements.js'
import { findBlock } from '../../sync/blocks.js'
import { HUSKY_PRE_COMMIT, PRE_COMMIT_BLOCK_ID, profileDependencies } from '../../sync/desired.js'
import { RECEIPT_PATH, readReceipt } from '../../sync/receipt.js'
import { ESLINT_CONFIG_FILE } from '../lint.js'
import { plural, type Output } from '../output.js'
import { inspectPrograms } from '../typescript.js'
import { ownershipIssues, selectedPrograms, type Workspace } from '../workspace.js'
import { installedIdentity } from './manage.js'

const satisfiesNode = (version: string): boolean => {
  const [major = 0, minor = 0] = version.replace(/^v/, '').split('.').map(Number)
  const [floorMajor = 0, floorMinor = 0, floorPatch = 0] = toolchain.runtime.node
    .split('.')
    .map(Number)
  const patch = Number(version.replace(/^v/, '').split('.')[2] ?? 0)
  if (major !== floorMajor) {
    return false
  }
  return minor > floorMinor || (minor === floorMinor && patch >= floorPatch)
}

/** Installed and declared versions of every managed tool the selected profiles use. */
const versionIssues = (resolved: ResolvedConfig): Array<Issue> => {
  const issues: Array<Issue> = []
  const manifest = readManifest(resolved.root)
  const declared = { ...(manifest?.dependencies ?? {}), ...(manifest?.devDependencies ?? {}) }
  const identity = installedIdentity()
  const expected = profileDependencies(resolved, declared, identity.version)
  for (const [name, version] of Object.entries(expected)) {
    const installed = findInstalledPackage(resolved.root, name)
    const spec = declared[name]
    const accepted =
      name === 'typescript'
        ? toolchain.core.typescript
        : name === '@toolpath/api'
          ? [toolchain.engine.contracts[resolved.engine?.contract ?? '']?.sdk ?? version]
          : [version]
    if (!installed) {
      issues.push({
        path: name,
        message: `is not installed; this release needs ${name}@${accepted.join(' or ')}. Run \`toolpath-dev sync\``,
      })
      continue
    }
    if (!accepted.includes(installed.version)) {
      issues.push({
        path: name,
        message: `${installed.version} is installed; this release is tested with ${accepted.join(' or ')}. Run \`toolpath-dev sync\` to align it`,
      })
    }
    const localSelf =
      name === '@toolpath/dev-config' && spec !== undefined && /^(file:|link:|\.|\/)/.test(spec)
    if (spec !== undefined && !accepted.includes(spec) && !localSelf) {
      issues.push({
        path: `package.json ${name}`,
        message: `is declared as "${spec}"; managed tools are declared at one exact version`,
      })
    }
  }
  if (resolved.engine) {
    const sdk = findInstalledPackage(resolved.root, '@toolpath/api')
    const contract = sdk ? contractForSdkVersion(sdk.version) : undefined
    if (sdk && contract !== resolved.engine.contract) {
      issues.push({
        path: 'engine.contract',
        message: `is ${resolved.engine.contract}, but the installed @toolpath/api@${sdk.version} matches ${contract ?? 'no supported contract'}`,
      })
    }
  }
  return issues
}

const nativeConfigIssues = (resolved: ResolvedConfig): Array<Issue> => {
  const issues: Array<Issue> = []
  const read = (path: string): string | undefined =>
    existsSync(join(resolved.root, path))
      ? readFileSync(join(resolved.root, path), 'utf8')
      : undefined
  const eslint = read(ESLINT_CONFIG_FILE)
  if (
    eslint === undefined ||
    !eslint.includes('@toolpath/dev-config/eslint') ||
    !eslint.includes('createEslintConfig')
  ) {
    issues.push({
      path: ESLINT_CONFIG_FILE,
      message: 'must export `await createEslintConfig(config)` from @toolpath/dev-config/eslint',
    })
  }
  const prettier = read('prettier.config.mjs')
  if (prettier === undefined || !prettier.includes('@toolpath/dev-config/prettier')) {
    issues.push({
      path: 'prettier.config.mjs',
      message: "must be `export { default } from '@toolpath/dev-config/prettier'`",
    })
  }
  for (const project of resolved.projects) {
    for (const suite of project.suites) {
      if (!suite.config) {
        continue
      }
      const factory = {
        vitest: 'createVitestConfig',
        'jest-expo': 'createJestExpoConfig',
        playwright: 'createPlaywrightConfig',
        command: '',
      }[suite.runner]
      const text = readFileSync(suite.config, 'utf8')
      if (factory !== '' && !text.includes(factory)) {
        issues.push({
          path: suite.config.slice(resolved.root.length + 1),
          message: `must build its config with ${factory} so ${suite.id} runs the standard`,
        })
      }
    }
  }
  return issues
}

const hookIssues = (resolved: ResolvedConfig): Array<Issue> => {
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: resolved.root,
    encoding: 'utf8',
  })
  if (top.status !== 0) {
    return []
  }
  const root = top.stdout.trim()
  const issues: Array<Issue> = []
  const hook = join(root, HUSKY_PRE_COMMIT)
  const text = existsSync(hook) ? readFileSync(hook, 'utf8') : ''
  let block
  try {
    block = findBlock(text, 'hash', PRE_COMMIT_BLOCK_ID)
  } catch (error) {
    issues.push({ path: HUSKY_PRE_COMMIT, message: (error as Error).message })
  }
  if (!block?.content.includes('toolpath-dev hooks pre-commit')) {
    issues.push({
      path: HUSKY_PRE_COMMIT,
      message: 'does not run `toolpath-dev hooks pre-commit`; run `toolpath-dev sync`',
    })
  }
  if (!process.env.CI) {
    const hooksPath = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd: root,
      encoding: 'utf8',
    }).stdout.trim()
    if (hooksPath !== '.husky/_') {
      issues.push({
        path: 'git config core.hooksPath',
        message: `is "${hooksPath || 'unset'}"; run \`toolpath-dev hooks install\` (the prepare script does this on install)`,
      })
    }
  }
  const prepare = readManifest(resolved.root)?.scripts?.prepare ?? ''
  if (!prepare.includes('toolpath-dev hooks install')) {
    issues.push({
      path: 'package.json scripts.prepare',
      message: 'must run `toolpath-dev hooks install`',
    })
  }
  return issues
}

const receiptIssues = (resolved: ResolvedConfig): Array<Issue> => {
  const issues: Array<Issue> = []
  let receipt
  try {
    receipt = readReceipt(resolved.root)
  } catch (error) {
    return [{ path: RECEIPT_PATH, message: (error as Error).message }]
  }
  if (!receipt) {
    return [
      {
        path: RECEIPT_PATH,
        message: 'is missing; this repository was not initialized with `toolpath-dev init`',
      },
    ]
  }
  const identity = installedIdentity()
  if (receipt.package.version !== identity.version) {
    issues.push({
      path: RECEIPT_PATH,
      message: `records @toolpath/dev-config ${receipt.package.version}, but ${identity.version} is installed. Run \`toolpath-dev sync\``,
    })
  }
  if (identity.sourceSha !== null && receipt.release.sourceSha !== identity.sourceSha) {
    issues.push({
      path: RECEIPT_PATH,
      message: `records workflow revision ${receipt.release.sourceSha}, the installed release is ${identity.sourceSha}. Run \`toolpath-dev sync\``,
    })
  }
  for (const [path, entry] of Object.entries(receipt.files)) {
    if (!existsSync(join(resolved.root, path))) {
      issues.push({ path, message: 'is a managed file that is missing; run `toolpath-dev sync`' })
    } else if (entry.kind === 'blocks') {
      for (const id of Object.keys(entry.blocks)) {
        try {
          if (
            !findBlock(
              readFileSync(join(resolved.root, path), 'utf8'),
              path.endsWith('.md') ? 'markdown' : 'hash',
              id,
            )
          ) {
            issues.push({
              path,
              message: `is missing its managed "${id}" block; run \`toolpath-dev sync\``,
            })
          }
        } catch (error) {
          issues.push({ path, message: (error as Error).message })
        }
      }
    }
  }
  return issues
}

const workflowIssues = (resolved: ResolvedConfig): Array<Issue> => {
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: resolved.root,
    encoding: 'utf8',
  })
  const root = top.status === 0 ? top.stdout.trim() : resolved.root
  const file = join(root, CALLER_WORKFLOW_PATH)
  if (!existsSync(file)) {
    return [{ path: CALLER_WORKFLOW_PATH, message: 'is missing; run `toolpath-dev sync`' }]
  }
  return callerWorkflowIssues(readFileSync(file, 'utf8'), resolved, installedIdentity())
}

export interface DoctorFlags {
  config?: string
  projects: Array<string>
}

/**
 * Read-only diagnosis. Every section runs even after another fails, so one
 * invocation lists everything that needs attention.
 */
export const runDoctor = async (flags: DoctorFlags, output: Output): Promise<void> => {
  const sections: Array<{ name: string; issues: Array<Issue> }> = []
  if (!satisfiesNode(process.version)) {
    sections.push({
      name: 'runtime',
      issues: [
        {
          path: 'node',
          message: `${process.version} is outside the supported ${toolchain.runtime.nodeRange}`,
        },
      ],
    })
  }
  const config = await loadConfig(findConfigFile(process.cwd(), flags.config))
  const resolved = resolveConfig(config)
  const add = (name: string, collect: () => Array<Issue> | Promise<Array<Issue>>): Promise<void> =>
    Promise.resolve()
      .then(collect)
      .then(
        (issues) => {
          sections.push({ name, issues })
        },
        (error: unknown) => {
          sections.push({
            name,
            issues: [
              { path: name, message: error instanceof Error ? error.message : String(error) },
            ],
          })
        },
      )
  await add('package manager', () => {
    const manager = detectPackageManager(resolved.root)
    const tested = manager?.name === 'pnpm' ? toolchain.runtime.pnpm : toolchain.runtime.npm
    if (manager?.version !== undefined && manager.version.split('.')[0] !== tested.split('.')[0]) {
      return [
        {
          path: 'package.json packageManager',
          message: `${manager.name}@${manager.version} is outside the tested ${manager.name} ${tested.split('.')[0] ?? ''} line (${tested})`,
        },
      ]
    }
    return []
  })
  const scope = classifyFiles(resolved)
  const workspace: Workspace = {
    resolved,
    selected: resolved.projects,
    whole: true,
    scope: () => scope,
  }
  await add('ownership', () => ownershipIssues(scope))
  await add('typescript programs', () => inspectPrograms(resolved, selectedPrograms(workspace)))
  await add('tool versions', () => versionIssues(resolved))
  await add('native configs', () => nativeConfigIssues(resolved))
  await add('react', () => reactAdapterIssues(resolved))
  await add('hooks', () => hookIssues(resolved))
  await add('receipt', () => receiptIssues(resolved))
  await add('workflow', () => workflowIssues(resolved))

  const manual = resolved.projects.flatMap((project) =>
    project.suites.filter((suite) => suite.ci === 'manual'),
  )
  const required = resolved.projects.flatMap((project) =>
    project.suites.filter((suite) => suite.ci === 'required'),
  )
  output.record('doctor', {
    sections: sections.map(({ name, issues }) => ({ name, issues })),
    suites: {
      required: required.map((suite) => suite.id),
      manual: manual.map((suite) => ({ id: suite.id, reason: suite.reason })),
    },
    exceptions: resolved.exceptions,
    generated: scope.generated.length,
  })
  for (const suite of manual) {
    output.detail(`manual suite ${suite.id}: ${suite.reason ?? ''}`)
  }
  for (const exception of resolved.exceptions) {
    output.detail(
      `exception ${exception.rule} for ${exception.files.join(', ')}: ${exception.reason}${exception.expires ? ` (until ${exception.expires})` : ''}`,
    )
  }
  const failing = sections.filter((section) => section.issues.length > 0)
  if (failing.length > 0) {
    const issues = failing.flatMap((section) =>
      section.issues.map((issue) => ({
        path: `${section.name}: ${issue.path}`,
        message: issue.message,
      })),
    )
    throw new ConfigError(`doctor: ${plural(issues.length, 'problem')} found:`, issues)
  }
  output.line(
    `doctor: ${plural(sections.length, 'check')} passed; ${plural(required.length, 'required suite')}` +
      (manual.length > 0 ? `, ${manual.length} manual` : '') +
      (resolved.exceptions.length > 0
        ? `, ${plural(resolved.exceptions.length, 'policy exception')}`
        : ''),
  )
}
