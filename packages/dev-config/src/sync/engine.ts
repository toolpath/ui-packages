import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { ConfigError, type Issue } from '../errors.js'
import type { ReleaseIdentity } from '../release/metadata.js'
import { BlockError, commentStyleFor, findBlock, upsertBlock } from './blocks.js'
import type { DesiredState } from './desired.js'
import { mergeThreeWay, unifiedDiff } from './merge.js'
import { RECEIPT_PATH, serializeReceipt, type Receipt } from './receipt.js'

/**
 * Managed packages an application imports at runtime. They are installed as
 * production dependencies unless the repository already keeps them as dev ones.
 */
const RUNTIME_PACKAGES = new Set(['@toolpath/api'])

export interface Write {
  path: string
  before: string | undefined
  /** The new text, or `undefined` to remove a file the standard no longer manages. */
  after: string | undefined
  mode?: number
}

interface Conflict {
  path: string
  reason: string
  /** The change the standard proposes, against the repository's current text. */
  patch: string
}

export interface Plan {
  writes: Array<Write>
  conflicts: Array<Conflict>
  /** Exact `name@version` specs to install as dev dependencies with the repository's package manager. */
  installs: Record<string, string>
  /** Exact specs the application runs with (the Engine SDK), installed as production dependencies. */
  runtimeInstalls: Record<string, string>
  receipt: Receipt
}

interface ManifestShape {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  packageManager?: string
  [key: string]: unknown
}

const read = (root: string, path: string): string | undefined => {
  const file = join(root, path)
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

const indentOf = (text: string): string => /^[ \t]+(?=")/m.exec(text)?.[0] ?? '  '

export interface PlanInput {
  root: string
  desired: DesiredState
  receipt: Receipt | undefined
  identity: ReleaseIdentity
  /** The `packageManager` value for a manifest without one. */
  packageManager: string
  /** Paths that must not exist alongside the managed native configs (legacy config formats). */
  forbidden?: Array<{ path: string; reason: string }>
  /** Version of the installed dev-config package, which may be declared by a local tarball spec. */
  installedSelfVersion: string
  /** Agents-only synchronization leaves the manifest and non-agent files alone. */
  manifest?: boolean
  /** Write exact devDependencies into package.json instead of installing them (`--skip-install`). */
  writeDependencies?: boolean
}

/**
 * Plans every managed change before anything is written. Unchanged managed text
 * is updated, edited text is merged three ways against the last generated base,
 * and text that cannot be merged is a conflict with a proposed patch.
 */
export const planSync = (input: PlanInput): Plan => {
  const { root, desired, receipt, identity } = input
  const writes: Array<Write> = []
  const conflicts: Array<Conflict> = []
  const files: Receipt['files'] = {}

  // The caller lists what is present; a file entry shows its removal as the patch.
  for (const forbidden of input.forbidden ?? []) {
    const isFile = existsSync(join(root, forbidden.path))
    conflicts.push({
      path: forbidden.path,
      reason: forbidden.reason,
      patch: isFile ? unifiedDiff(forbidden.path, read(root, forbidden.path), undefined) : '',
    })
  }

  const pending = new Map<string, string | undefined>()
  const current = (path: string): string | undefined =>
    pending.has(path) ? pending.get(path) : read(root, path)
  const stage = (
    path: string,
    before: string | undefined,
    after: string | undefined,
    mode?: number,
  ): void => {
    if (before === after) {
      return
    }
    pending.set(path, after)
    const existing = writes.find((write) => write.path === path)
    if (existing) {
      existing.after = after
    } else {
      writes.push({ path, before, after, ...(mode === undefined ? {} : { mode }) })
    }
  }

  for (const item of desired.managed) {
    const text = current(item.path)
    if (item.kind === 'file') {
      const previous = receipt?.files[item.path]
      const base = previous?.kind === 'file' ? previous.base : undefined
      files[item.path] = { kind: 'file', base: item.content }
      if (text === undefined) {
        stage(item.path, undefined, item.content, item.mode)
        continue
      }
      if (base === undefined) {
        if (text !== item.content) {
          conflicts.push({
            path: item.path,
            reason:
              'exists and is not managed yet; merge it into the shared standard (docs/adoption.md), then rerun',
            patch: unifiedDiff(item.path, text, item.content),
          })
        }
        continue
      }
      const merged = mergeThreeWay(base, text, item.content)
      if (merged.ok) {
        stage(item.path, text, merged.text, item.mode)
      } else {
        conflicts.push({
          path: item.path,
          reason: `local edits overlap ${merged.conflicts === 1 ? 'a change' : `${merged.conflicts} changes`} in this release`,
          patch: unifiedDiff(item.path, text, item.content),
        })
      }
      continue
    }

    const style = commentStyleFor(item.path)
    const previous = receipt?.files[item.path]
    const base = previous?.kind === 'blocks' ? previous.blocks[item.id] : undefined
    const entry = files[item.path]
    files[item.path] = {
      kind: 'blocks',
      blocks: { ...(entry?.kind === 'blocks' ? entry.blocks : {}), [item.id]: item.content },
    }
    const source = text ?? ''
    let found
    try {
      found = findBlock(source, style, item.id)
    } catch (error) {
      if (!(error instanceof BlockError)) {
        throw error
      }
      conflicts.push({ path: item.path, reason: error.message, patch: '' })
      continue
    }
    let content = item.content
    if (found && base !== undefined) {
      const merged = mergeThreeWay(base, found.content, item.content)
      if (!merged.ok) {
        conflicts.push({
          path: item.path,
          reason: `the managed block "${item.id}" was edited where this release changes it`,
          patch: unifiedDiff(item.path, source, upsertBlock(source, style, item.id, item.content)),
        })
        continue
      }
      content = merged.text
    } else if (found && found.content !== item.content) {
      conflicts.push({
        path: item.path,
        reason: `has a "${item.id}" block that no receipt records; restore the receipt from Git or remove the block`,
        patch: unifiedDiff(item.path, source, upsertBlock(source, style, item.id, item.content)),
      })
      continue
    }
    stage(
      item.path,
      text,
      upsertBlock(source, style, item.id, content),
      text === undefined && item.path.endsWith('pre-commit') ? 0o755 : undefined,
    )
  }

  // A file an earlier release managed and this one does not, such as the Engine skill after the
  // profile is dropped, is removed while it still has the generated text; an edited one is the
  // repository's to decide. A scoped sync leaves files of the other scopes alone.
  const kept = new Set([
    ...desired.managed.map((item) => item.path),
    ...(desired.outsideScope ?? []),
  ])
  const retired = new Set<string>()
  for (const [path, entry] of Object.entries(receipt?.files ?? {})) {
    if (entry.kind !== 'file' || kept.has(path)) {
      continue
    }
    retired.add(path)
    const text = current(path)
    if (text === undefined) {
      continue
    }
    if (text === entry.base) {
      stage(path, text, undefined)
    } else {
      conflicts.push({
        path,
        reason:
          'is no longer managed by this release and has local edits; delete it, or move it to keep it as your own file, then rerun',
        patch: unifiedDiff(path, text, undefined),
      })
    }
  }
  const unretired = (entries: Receipt['files']): Receipt['files'] =>
    Object.fromEntries(Object.entries(entries).filter(([path]) => !retired.has(path)))

  let installs: Record<string, string> = {}
  let runtimeInstalls: Record<string, string> = {}
  const manifestReceipt: Receipt['manifest'] = { scripts: {}, devDependencies: {} }
  if (input.manifest !== false) {
    const manifestText = current('package.json')
    if (manifestText === undefined) {
      throw new ConfigError(
        `No package.json in ${root}. Create it first: \`npm init -y && npm pkg set type=module\`.`,
      )
    }
    const manifest = JSON.parse(manifestText) as ManifestShape
    const scripts = { ...(manifest.scripts ?? {}) }
    for (const [name, value] of Object.entries(desired.scripts)) {
      const existing = scripts[name]
      const base = receipt?.manifest.scripts[name]
      let next: string
      if (name === 'prepare' && existing !== undefined && existing.includes(value)) {
        // Already composed (by init, or by hand): the repository's own steps stay.
        next = existing
      } else if (existing === undefined || existing === value || existing === base) {
        next = value
      } else if (name === 'prepare') {
        // Compose with an existing prepare step; plain Husky is what `hooks install` runs itself.
        next = /^husky( install)?$/.test(existing.trim()) ? value : `${existing} && ${value}`
      } else {
        conflicts.push({
          path: 'package.json',
          reason: `script "${name}" is "${existing}"; the standard's is "${value}". Move what it does into the standard (or another script name), then rerun`,
          patch: '',
        })
        continue
      }
      scripts[name] = next
      manifestReceipt.scripts[name] = next
    }
    const declared = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }
    for (const [name, version] of Object.entries(desired.devDependencies)) {
      manifestReceipt.devDependencies[name] = version
      const runtime = RUNTIME_PACKAGES.has(name) && manifest.devDependencies?.[name] === undefined
      if (
        manifest.dependencies?.[name] !== undefined &&
        manifest.devDependencies?.[name] === undefined &&
        !runtime
      ) {
        conflicts.push({
          path: 'package.json',
          reason: `${name} is a runtime dependency here; development tools are exact devDependencies. Move it to devDependencies`,
          patch: '',
        })
        continue
      }
      const spec = declared[name]
      const isSelfFromLocalSpec =
        name === '@toolpath/dev-config' &&
        spec !== undefined &&
        version === input.installedSelfVersion &&
        /^(file:|link:|\.|\/)/.test(spec)
      if (spec !== version && !isSelfFromLocalSpec) {
        if (runtime) {
          runtimeInstalls[name] = version
        } else {
          installs[name] = version
        }
      }
    }
    const packageManager = manifest.packageManager ?? input.packageManager
    // Recorded on every run, so a second sync after init plans no receipt change.
    manifestReceipt.packageManager = packageManager
    const sorted = (entries: Record<string, string>): Record<string, string> =>
      Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))
    const devDependencies = { ...(manifest.devDependencies ?? {}) }
    const dependencies = { ...(manifest.dependencies ?? {}) }
    if (input.writeDependencies) {
      Object.assign(devDependencies, installs)
      Object.assign(dependencies, runtimeInstalls)
    }
    const writesDev = input.writeDependencies === true && Object.keys(installs).length > 0
    const writesRuntime =
      input.writeDependencies === true && Object.keys(runtimeInstalls).length > 0
    if (input.writeDependencies) {
      installs = {}
      runtimeInstalls = {}
    }
    const next: ManifestShape = {
      ...manifest,
      scripts,
      ...(writesRuntime ? { dependencies: sorted(dependencies) } : {}),
      ...(writesDev ? { devDependencies: sorted(devDependencies) } : {}),
      ...(manifest.packageManager === undefined ? { packageManager } : {}),
    }
    const nextText = `${JSON.stringify(next, null, indentOf(manifestText))}\n`
    stage('package.json', manifestText, nextText)
  }

  const receiptValue: Receipt = {
    schemaVersion: 1,
    package: { name: identity.name, version: identity.version },
    release: {
      repository: identity.repository,
      sourceSha: identity.sourceSha ?? '',
      workflow: identity.workflow,
    },
    files: input.manifest === false && receipt ? { ...unretired(receipt.files), ...files } : files,
    manifest: input.manifest === false && receipt ? receipt.manifest : manifestReceipt,
  }
  return { writes, conflicts, installs, runtimeInstalls, receipt: receiptValue }
}

/** A complete reviewable diff of a plan, including the receipt and installs. */
export const describePlan = (plan: Plan, receiptBefore: string | undefined): string => {
  const parts = plan.writes.map((write) => unifiedDiff(write.path, write.before, write.after))
  const receipt = serializeReceipt(plan.receipt)
  if (receipt !== receiptBefore) {
    parts.push(unifiedDiff(RECEIPT_PATH, receiptBefore, receipt))
  }
  const installs = Object.entries(plan.installs)
  if (installs.length > 0) {
    parts.push(
      `# install exact dev dependencies:\n${installs.map(([name, version]) => `#   ${name}@${version}`).join('\n')}\n`,
    )
  }
  const runtime = Object.entries(plan.runtimeInstalls)
  if (runtime.length > 0) {
    parts.push(
      `# install exact runtime dependencies:\n${runtime.map(([name, version]) => `#   ${name}@${version}`).join('\n')}\n`,
    )
  }
  return parts.filter((part) => part !== '').join('\n')
}

export const conflictIssues = (plan: Plan): Array<Issue> =>
  plan.conflicts.map((conflict) => ({ path: conflict.path, message: conflict.reason }))

/** Replaces a file through a temporary sibling and a rename, keeping an existing file's mode. */
export const writeAtomically = (path: string, content: string, mode?: number): void => {
  // A symlinked file (an AGENTS.md shared with CLAUDE.md) is updated where it points, so the
  // link and every other name for the file keep seeing the same content.
  const target = existsSync(path) && lstatSync(path).isSymbolicLink() ? realpathSync(path) : path
  mkdirSync(dirname(target), { recursive: true })
  const temporary = `${target}.toolpath-dev-${process.pid}.tmp`
  const existingMode = existsSync(target) ? statSync(target).mode & 0o777 : undefined
  writeFileSync(temporary, content, { mode: mode ?? existingMode ?? 0o644 })
  renameSync(temporary, target)
}

/** Removes a file (a symlink itself, not its target) and the directories it leaves empty. */
const removeManaged = (root: string, path: string): void => {
  rmSync(join(root, path), { force: true })
  for (
    let directory = dirname(path);
    directory !== '.' && basename(directory) !== '..';
    directory = dirname(directory)
  ) {
    const absolute = join(root, directory)
    if (!existsSync(absolute) || readdirSync(absolute).length > 0) {
      return
    }
    rmdirSync(absolute)
  }
}

export const applyWrites = (root: string, writes: ReadonlyArray<Write>): void => {
  for (const write of writes) {
    if (write.after === undefined) {
      removeManaged(root, write.path)
    } else {
      writeAtomically(join(root, write.path), write.after, write.mode)
    }
  }
}
