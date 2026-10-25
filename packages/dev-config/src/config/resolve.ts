import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { ConfigError, type Issue } from '../errors.js'
import { toolchain } from '../policy/toolchain.js'
import { relativePosix } from './files.js'
import type {
  BuildStep,
  CommandReportFormat,
  DevConfig,
  EngineConfig,
  PolicyException,
  Prerequisites,
  ProjectConfig,
  ProjectKind,
  ProjectRuntime,
  ReactAdapter,
  ReactMinimumVersion,
  ReasonedFiles,
  SuiteCi,
} from './types.js'

export type SuiteRunner = 'vitest' | 'jest-expo' | 'playwright' | 'command'

export interface ResolvedSuite {
  /** `project:suite`, the stable identifier CI receipts and `--suite` use. */
  id: string
  project: string
  name: string
  runner: SuiteRunner
  /** Unit/component suites run in every ordinary `check` and `test`. */
  ordinary: boolean
  ci: SuiteCi
  reason?: string
  /** Absolute runner configuration path, for runner suites. */
  config?: string
  argv?: Array<string>
  report?: { format: CommandReportFormat; path: string }
  browsers: Array<'chromium' | 'firefox' | 'webkit'>
  prerequisites: Required<Prerequisites>
  timeoutMinutes?: number
}

export interface PackageManifest {
  name?: string
  version?: string
  private?: boolean
  packageManager?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  workspaces?: Array<string> | { packages?: Array<string> }
}

export interface ResolvedProject {
  name: string
  /** Absolute project directory. */
  directory: string
  /** POSIX path relative to the configuration root; `'.'` for the root project. */
  path: string
  kind: ProjectKind
  runtime: ProjectRuntime
  tsconfig: string
  /** The test files' program, when the project separates it. */
  testTsconfig?: string
  dependsOn: Array<string>
  react?: { adapter: ReactAdapter; minimumVersion: ReactMinimumVersion }
  suites: Array<ResolvedSuite>
  build?: BuildStep
  noUnitTests?: { reason: string }
  manifest?: PackageManifest
}

export interface ResolvedConfig {
  config: DevConfig
  /** Absolute configuration root. */
  root: string
  /** Topologically ordered: every project after the projects it depends on. */
  projects: Array<ResolvedProject>
  tooling?: { files: Array<string>; tsconfig: string }
  generated: Array<ReasonedFiles>
  formatIgnore: Array<ReasonedFiles>
  exceptions: Array<PolicyException>
  engine?: EngineConfig
  skillsDir: string
  externalSuites: Array<{ project: string; suite: string; job: string }>
}

export const readManifest = (directory: string): PackageManifest | undefined => {
  const file = join(directory, 'package.json')
  if (!existsSync(file)) {
    return undefined
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as PackageManifest
  } catch (error) {
    throw new ConfigError(`${file} is not valid JSON: ${(error as Error).message}`)
  }
}

let plannedFiles: ReadonlySet<string> = new Set()
const isFile = (path: string): boolean =>
  plannedFiles.has(path) || (existsSync(path) && statSync(path).isFile())
const isDirectory = (path: string): boolean => existsSync(path) && statSync(path).isDirectory()

const manifestDependencies = (manifest: PackageManifest): Set<string> =>
  new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ])

const resolveSuites = (
  project: ProjectConfig,
  directory: string,
  root: string,
  issues: Array<Issue>,
  at: string,
): Array<ResolvedSuite> =>
  Object.entries(project.suites ?? {}).map(([name, suite]) => {
    const base = {
      id: `${project.name}:${name}`,
      project: project.name,
      name,
      runner: suite.runner,
      ordinary: suite.runner === 'vitest' || suite.runner === 'jest-expo',
      browsers: [] as Array<'chromium' | 'firefox' | 'webkit'>,
      prerequisites: { env: [], commands: [] } as Required<Prerequisites>,
    }
    if (
      suite.runner === 'vitest' ||
      suite.runner === 'jest-expo' ||
      suite.runner === 'playwright'
    ) {
      const config = join(directory, suite.config)
      if (!isFile(config)) {
        issues.push({
          path: `${at}.suites.${name}.config`,
          message: `${relativePosix(root, config)} does not exist`,
        })
      }
      if (suite.runner === 'playwright') {
        return {
          ...base,
          config,
          ci: suite.ci ?? 'required',
          ...(suite.reason === undefined ? {} : { reason: suite.reason }),
          browsers: suite.browsers ?? ['chromium'],
          prerequisites: {
            env: suite.prerequisites?.env ?? [],
            commands: suite.prerequisites?.commands ?? [],
          },
        }
      }
      return { ...base, config, ci: 'required' as const }
    }
    return {
      ...base,
      argv: [...suite.argv],
      report: { ...suite.report },
      ci: suite.ci ?? 'required',
      ...(suite.reason === undefined ? {} : { reason: suite.reason }),
      prerequisites: {
        env: suite.prerequisites?.env ?? [],
        commands: suite.prerequisites?.commands ?? [],
      },
      ...(suite.timeoutMinutes === undefined ? {} : { timeoutMinutes: suite.timeoutMinutes }),
    }
  })

/** Projects ordered so each follows its dependencies; reports the first cycle found. */
const topologicalOrder = (
  projects: ReadonlyArray<ResolvedProject>,
  issues: Array<Issue>,
): Array<ResolvedProject> => {
  const byName = new Map(projects.map((project) => [project.name, project]))
  const ordered: Array<ResolvedProject> = []
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (project: ResolvedProject, trail: Array<string>): boolean => {
    const current = state.get(project.name)
    if (current === 'done') {
      return true
    }
    if (current === 'visiting') {
      const cycle = [...trail.slice(trail.indexOf(project.name)), project.name]
      issues.push({ path: 'projects', message: `dependency cycle: ${cycle.join(' -> ')}` })
      return false
    }
    state.set(project.name, 'visiting')
    for (const dependency of project.dependsOn) {
      const target = byName.get(dependency)
      if (target && !visit(target, [...trail, project.name])) {
        return false
      }
    }
    state.set(project.name, 'done')
    ordered.push(project)
    return true
  }
  for (const project of projects) {
    if (!visit(project, [])) {
      break
    }
  }
  return ordered
}

/**
 * Resolves a validated configuration against the repository: every path exists
 * inside it, project roots are distinct, the dependency graph is acyclic, and
 * declared dependencies agree with the workspace manifests.
 */
export interface ResolveOptions {
  /** Absolute paths treated as existing files: what `init` plans to write before it writes anything. */
  planned?: ReadonlySet<string>
}

export const resolveConfig = (
  config: DevConfig,
  { planned = new Set() }: ResolveOptions = {},
): ResolvedConfig => {
  plannedFiles = planned
  const issues: Array<Issue> = []
  const root = realpathSync(config.directory)

  const inside = (path: string): boolean => {
    const relativePath = relativePosix(root, path)
    return relativePath === '' || (!relativePath.startsWith('../') && relativePath !== '..')
  }

  const projects: Array<ResolvedProject> = config.projects.map((project, index) => {
    const at = `projects[${index}]`
    const directory = resolve(root, project.root)
    const path = relativePosix(root, directory) || '.'
    if (!inside(directory)) {
      issues.push({ path: `${at}.root`, message: 'is outside the configuration root' })
    } else if (!isDirectory(directory)) {
      issues.push({ path: `${at}.root`, message: `${path} is not a directory` })
    } else if (realpathSync(directory) !== directory) {
      issues.push({
        path: `${at}.root`,
        message: `${path} is a symbolic link; name the real directory`,
      })
    }
    const tsconfig = join(directory, project.tsconfig)
    if (!isFile(tsconfig)) {
      issues.push({
        path: `${at}.tsconfig`,
        message: `${relativePosix(root, tsconfig)} does not exist`,
      })
    }
    let testTsconfig: string | undefined
    if (project.testTsconfig !== undefined) {
      testTsconfig = join(directory, project.testTsconfig)
      if (!isFile(testTsconfig)) {
        issues.push({
          path: `${at}.testTsconfig`,
          message: `${relativePosix(root, testTsconfig)} does not exist`,
        })
      }
    }
    const manifest = isDirectory(directory) ? readManifest(directory) : undefined
    return {
      name: project.name,
      directory,
      path,
      kind: project.kind,
      runtime: project.runtime,
      tsconfig,
      ...(testTsconfig === undefined ? {} : { testTsconfig }),
      dependsOn: [...(project.dependsOn ?? [])],
      ...(project.react === undefined
        ? {}
        : {
            react: {
              adapter: project.react.adapter,
              minimumVersion:
                project.react.minimumVersion ??
                (toolchain.react.defaultMinimumVersion as ReactMinimumVersion),
            },
          }),
      suites: resolveSuites(project, directory, root, issues, at),
      ...(project.build === undefined
        ? {}
        : { build: { argv: [...project.build.argv], outputs: [...project.build.outputs] } }),
      ...(project.noUnitTests === undefined ? {} : { noUnitTests: { ...project.noUnitTests } }),
      ...(manifest === undefined ? {} : { manifest }),
    }
  })

  const seenNames = new Map<string, number>()
  const seenRoots = new Map<string, string>()
  projects.forEach((project, index) => {
    const previous = seenNames.get(project.name)
    if (previous !== undefined) {
      issues.push({
        path: `projects[${index}].name`,
        message: `"${project.name}" is already used by projects[${previous}]`,
      })
    }
    seenNames.set(project.name, index)
    const owner = seenRoots.get(project.path)
    if (owner !== undefined) {
      issues.push({
        path: `projects[${index}].root`,
        message: `${project.path} is already the root of "${owner}"; each directory has one owning project`,
      })
    }
    seenRoots.set(project.path, project.name)
  })

  const byPackageName = new Map<string, ResolvedProject>()
  for (const project of projects) {
    if (project.manifest?.name) {
      byPackageName.set(project.manifest.name, project)
    }
  }
  projects.forEach((project, index) => {
    for (const dependency of project.dependsOn) {
      const target = projects.find((candidate) => candidate.name === dependency)
      if (!target) {
        issues.push({
          path: `projects[${index}].dependsOn`,
          message: `"${dependency}" is not a configured project`,
        })
        continue
      }
      if (target === project) {
        issues.push({
          path: `projects[${index}].dependsOn`,
          message: 'a project cannot depend on itself',
        })
        continue
      }
      if (
        project.manifest &&
        target.manifest?.name &&
        project.path !== '.' &&
        !manifestDependencies(project.manifest).has(target.manifest.name)
      ) {
        issues.push({
          path: `projects[${index}].dependsOn`,
          message: `"${dependency}" is declared here, but ${project.path}/package.json does not depend on ${target.manifest.name}. Add the dependency or remove it from dependsOn`,
        })
      }
    }
    if (project.manifest) {
      for (const name of manifestDependencies(project.manifest)) {
        const target = byPackageName.get(name)
        if (target && target !== project && !project.dependsOn.includes(target.name)) {
          project.dependsOn.push(target.name)
        }
      }
    }
  })

  const ordered = issues.length === 0 ? topologicalOrder(projects, issues) : projects

  let tooling: ResolvedConfig['tooling']
  if (config.tooling) {
    const tsconfig = join(root, config.tooling.tsconfig)
    if (!isFile(tsconfig)) {
      issues.push({
        path: 'tooling.tsconfig',
        message: `${config.tooling.tsconfig} does not exist`,
      })
    }
    tooling = { files: [...config.tooling.files], tsconfig }
  }

  if (config.ci.node !== toolchain.runtime.node) {
    issues.push({
      path: 'ci.node',
      message: `must be ${toolchain.runtime.node}, the Node this release of @toolpath/dev-config is tested on`,
    })
  }

  if (config.engine && toolchain.engine.contracts[config.engine.contract] === undefined) {
    issues.push({
      path: 'engine.contract',
      message: `"${config.engine.contract}" is not a supported contract. Supported: ${Object.keys(toolchain.engine.contracts).join(', ')}`,
    })
  }

  const externalSuites = [...(config.ci.externalSuites ?? [])]
  const mapped = new Set<string>()
  const jobs = new Map<string, string>()
  externalSuites.forEach((entry, index) => {
    const at = `ci.externalSuites[${index}]`
    const suite = ordered
      .find((project) => project.name === entry.project)
      ?.suites.find((candidate) => candidate.name === entry.suite)
    if (!suite) {
      issues.push({ path: at, message: `${entry.project}:${entry.suite} is not a declared suite` })
      return
    }
    if (suite.ordinary) {
      issues.push({
        path: at,
        message: `${suite.id} is a unit suite; it always runs in the standards job`,
      })
    } else if (suite.ci !== 'required') {
      issues.push({
        path: at,
        message: `${suite.id} is manual; only required suites are delegated to caller jobs`,
      })
    }
    if (mapped.has(suite.id)) {
      issues.push({ path: at, message: `${suite.id} is mapped more than once` })
    }
    mapped.add(suite.id)
    const existing = jobs.get(entry.job)
    if (existing !== undefined) {
      issues.push({ path: `${at}.job`, message: `job "${entry.job}" already runs ${existing}` })
    }
    jobs.set(entry.job, suite.id)
  })

  if (issues.length > 0) {
    throw new ConfigError(`${basename(config.file)} does not match the repository:`, issues)
  }

  return {
    config,
    root,
    projects: ordered,
    ...(tooling === undefined ? {} : { tooling }),
    generated: [...(config.generated ?? [])],
    formatIgnore: [...(config.formatIgnore ?? [])],
    exceptions: [...(config.exceptions ?? [])],
    ...(config.engine === undefined ? {} : { engine: config.engine }),
    skillsDir: config.agents?.skillsDir ?? '.claude/skills',
    externalSuites,
  }
}

/** The named projects plus everything they depend on, in build order. */
export const withDependencies = (
  resolved: ResolvedConfig,
  names: ReadonlyArray<string>,
): Array<ResolvedProject> => {
  const wanted = new Set<string>()
  const add = (name: string): void => {
    if (wanted.has(name)) {
      return
    }
    wanted.add(name)
    const project = resolved.projects.find((candidate) => candidate.name === name)
    for (const dependency of project?.dependsOn ?? []) {
      add(dependency)
    }
  }
  for (const name of names) {
    add(name)
  }
  return resolved.projects.filter((project) => wanted.has(project.name))
}

/** Projects selected by `--project` flags (all when none), failing on an unknown name. */
export const selectProjects = (
  resolved: ResolvedConfig,
  names: ReadonlyArray<string>,
): Array<ResolvedProject> => {
  if (names.length === 0) {
    return resolved.projects
  }
  const unknown = names.filter(
    (name) => !resolved.projects.some((project) => project.name === name),
  )
  if (unknown.length > 0) {
    throw new ConfigError(
      `Unknown project${unknown.length === 1 ? '' : 's'} ${unknown.map((name) => `"${name}"`).join(', ')}. ` +
        `Configured: ${resolved.projects.map((project) => project.name).join(', ')}`,
    )
  }
  return resolved.projects.filter((project) => names.includes(project.name))
}
