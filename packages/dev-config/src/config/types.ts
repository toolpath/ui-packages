/**
 * The consumer's `dev.config.mjs` contract. Every field here is a project fact:
 * where code lives, how it runs, and which suites prove it. Policy itself is not
 * configurable; `exceptions` is the only structured way to narrow a rule.
 */

export type ProjectKind = 'application' | 'library' | 'tooling'

/** Which platform APIs a project may use, and so its globals and test environment. */
export type ProjectRuntime = 'node' | 'dom' | 'native' | 'universal'

export type ReactAdapter =
  'vite-legacy' | 'vite-modern' | 'react-router' | 'expo' | 'library-esbuild' | 'babel'

export type ReactMinimumVersion = '17' | '18' | '19'

export interface ReactSettings {
  adapter: ReactAdapter
  /** The oldest React the shipped code supports; the compiler targets it. Default `'19'`. */
  minimumVersion?: ReactMinimumVersion
}

/** Specialized suites run in CI unless they are explicitly manual, with a reason. */
export type SuiteCi = 'required' | 'manual'

export interface Prerequisites {
  /** Environment variable names (never values) that must be set before the suite runs. */
  env?: Array<string>
  /** Executables that must be on `PATH`. */
  commands?: Array<string>
}

export interface VitestSuite {
  runner: 'vitest'
  /** Project-relative runner configuration that calls `createVitestConfig`. */
  config: string
}

export interface JestExpoSuite {
  runner: 'jest-expo'
  config: string
}

export interface PlaywrightSuite {
  runner: 'playwright'
  config: string
  ci?: SuiteCi
  reason?: string
  /** Browsers CI installs for this suite. Default `['chromium']`. */
  browsers?: Array<'chromium' | 'firefox' | 'webkit'>
  prerequisites?: Prerequisites
}

export type CommandReportFormat = 'vitest-json' | 'jest-json' | 'playwright-json' | 'junit'

export interface CommandSuite {
  runner: 'command'
  /** Executed directly from the project root, never through a shell. */
  argv: Array<string>
  /** The machine-readable result that proves tests ran. A zero exit alone is not evidence. */
  report: { format: CommandReportFormat; path: string }
  ci?: SuiteCi
  reason?: string
  prerequisites?: Prerequisites
  timeoutMinutes?: number
}

export type Suite = VitestSuite | JestExpoSuite | PlaywrightSuite | CommandSuite

export interface BuildStep {
  argv: Array<string>
  /** Project-relative outputs the build produces, checked after it runs. */
  outputs: Array<string>
}

export interface ProjectConfig {
  name: string
  /** Relative to the configuration file; `'.'` for a root project. */
  root: string
  kind: ProjectKind
  runtime: ProjectRuntime
  /** Relative to the project root. */
  tsconfig: string
  dependsOn?: Array<string>
  react?: ReactSettings
  suites?: Record<string, Suite>
  noUnitTests?: { reason: string }
  build?: BuildStep
}

export interface ReasonedFiles {
  files: Array<string>
  reason: string
}

export interface PolicyException {
  /** An exact rule identifier the effective policy contains. */
  rule: string
  files: Array<string>
  reason: string
  issue?: string
  /** ISO date (`YYYY-MM-DD`); an expired entry fails diagnosis. */
  expires?: string
}

export interface ExternalSuite {
  project: string
  suite: string
  /** The caller workflow job that runs this suite with the shared check action. */
  job: string
}

export interface CiConfig {
  /** Must equal the release's pinned Node. */
  node: string
  externalSuites?: Array<ExternalSuite>
}

export interface EngineConfig {
  contract: string
  integrationFiles: Array<string>
  compatibilityFiles?: Array<ReasonedFiles>
  origins?: Array<string>
}

export interface AgentsConfig {
  /** Repository-relative skill directory. Default `.claude/skills`. */
  skillsDir?: string
}

export interface DevConfigInput {
  schemaVersion: 1
  /** `import.meta.url` of the configuration module itself. */
  root: string
  projects: Array<ProjectConfig>
  tooling?: { files: Array<string>; tsconfig: string }
  generated?: Array<ReasonedFiles>
  formatIgnore?: Array<ReasonedFiles>
  exceptions?: Array<PolicyException>
  ci: CiConfig
  engine?: EngineConfig
  agents?: AgentsConfig
}

/** A validated configuration: `defineConfig`'s result, deeply frozen. */
export interface DevConfig extends DevConfigInput {
  /** The configuration's directory, as an absolute path. */
  readonly directory: string
  /** The configuration module's absolute path. */
  readonly file: string
}
