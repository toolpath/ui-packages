import type { Issue } from '../errors.js'

/**
 * Structural validation of `dev.config.mjs`, without touching the filesystem.
 * Repository checks (missing files, ownership, cycles) belong to `resolve.ts`.
 *
 * Written out field by field rather than generated from a schema library so each
 * message names the exact path and, for a misspelling, the intended field.
 */

type Shape = Record<string, unknown>

const PROJECT_KINDS = ['application', 'library', 'tooling'] as const
const RUNTIMES = ['node', 'dom', 'native', 'universal'] as const
const REACT_ADAPTERS = [
  'vite-legacy',
  'vite-modern',
  'react-router',
  'expo',
  'library-esbuild',
  'babel',
] as const
const REACT_MINIMUM_VERSIONS = ['17', '18', '19'] as const
const RUNNERS = ['vitest', 'playwright', 'jest-expo', 'command'] as const
const CI_MODES = ['required', 'manual'] as const
const REPORT_FORMATS = ['vitest-json', 'jest-json', 'playwright-json', 'junit'] as const
const BROWSERS = ['chromium', 'firefox', 'webkit'] as const

const NAME = /^[a-z0-9][a-z0-9._-]*$/
const JOB_ID = /^[A-Za-z_][A-Za-z0-9_-]*$/
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const GLOB_CHARACTERS = /[*?[\]{}()!+@]/

const isRecord = (value: unknown): value is Shape =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const editDistance = (a: string, b: string): number => {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0] ?? 0
    previous[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j] ?? 0
      const left = previous[j - 1] ?? 0
      previous[j] = Math.min(above + 1, left + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return previous[b.length] ?? 0
}

const suggestion = (key: string, allowed: ReadonlyArray<string>): string => {
  const closest = allowed
    .map((candidate) => ({
      candidate,
      distance: editDistance(key.toLowerCase(), candidate.toLowerCase()),
    }))
    .sort((a, b) => a.distance - b.distance)[0]
  return closest && closest.distance <= 2 ? ` Did you mean "${closest.candidate}"?` : ''
}

class Validator {
  readonly issues: Array<Issue> = []

  readonly fail = (path: string, message: string): void => {
    this.issues.push({ path, message })
  }

  /** Checks an object's keys; returns it when it is an object. */
  readonly object = (
    value: unknown,
    path: string,
    required: ReadonlyArray<string>,
    optional: ReadonlyArray<string>,
  ): Shape | undefined => {
    if (!isRecord(value)) {
      this.fail(path, 'must be an object')
      return undefined
    }
    const allowed = [...required, ...optional]
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        this.fail(
          path === '' ? key : `${path}.${key}`,
          `is not a known field.${suggestion(key, allowed)}`,
        )
      }
    }
    for (const key of required) {
      if (value[key] === undefined) {
        this.fail(path === '' ? key : `${path}.${key}`, 'is required')
      }
    }
    return value
  }

  readonly string = (value: unknown, path: string): value is string => {
    if (typeof value !== 'string' || value.trim() === '') {
      this.fail(path, 'must be a nonempty string')
      return false
    }
    return true
  }

  readonly reason = (value: unknown, path: string): void => {
    if (typeof value !== 'string' || value.trim().length < 10) {
      this.fail(path, 'must explain the reason in at least ten characters')
    }
  }

  readonly oneOf = <T extends string>(
    value: unknown,
    path: string,
    options: ReadonlyArray<T>,
  ): value is T => {
    if (typeof value !== 'string' || !(options as ReadonlyArray<string>).includes(value)) {
      this.fail(path, `must be one of ${options.map((option) => `'${option}'`).join(', ')}`)
      return false
    }
    return true
  }

  readonly array = (
    value: unknown,
    path: string,
    { nonEmpty = true } = {},
  ): value is Array<unknown> => {
    if (!Array.isArray(value)) {
      this.fail(path, 'must be an array')
      return false
    }
    if (nonEmpty && value.length === 0) {
      this.fail(path, 'must not be empty')
      return false
    }
    return true
  }

  /** A repository-relative path that cannot escape the configuration directory. */
  readonly relativePath = (value: unknown, path: string): value is string => {
    if (!this.string(value, path)) {
      return false
    }
    if (value.includes('\\')) {
      this.fail(path, 'must use forward slashes')
      return false
    }
    if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) {
      this.fail(path, 'must be relative to its base directory, not absolute')
      return false
    }
    if (value.split('/').includes('..')) {
      this.fail(path, 'must not contain ".." segments; paths stay inside the repository')
      return false
    }
    return true
  }

  /** A glob with at least one literal path segment, so it cannot select the whole repository. */
  readonly narrowGlob = (value: unknown, path: string): void => {
    if (!this.relativePath(value, path)) {
      return
    }
    const literal = value
      .split('/')
      .filter((segment) => segment !== '' && segment !== '.')
      .some((segment) => !GLOB_CHARACTERS.test(segment))
    if (!literal) {
      this.fail(path, `"${value}" selects files everywhere; name the directory or file it is for`)
    }
  }

  readonly globs = (value: unknown, path: string): void => {
    if (!this.array(value, path)) {
      return
    }
    value.forEach((glob, index) => {
      this.narrowGlob(glob, `${path}[${index}]`)
    })
  }

  readonly reasonedFiles = (value: unknown, path: string): void => {
    if (!this.array(value, path, { nonEmpty: false })) {
      return
    }
    value.forEach((entry, index) => {
      const at = `${path}[${index}]`
      const shape = this.object(entry, at, ['files', 'reason'], [])
      if (!shape) {
        return
      }
      this.globs(shape.files, `${at}.files`)
      this.reason(shape.reason, `${at}.reason`)
    })
  }

  readonly argv = (value: unknown, path: string): void => {
    if (!this.array(value, path)) {
      return
    }
    value.forEach((argument, index) => {
      if (typeof argument !== 'string' || argument === '') {
        this.fail(`${path}[${index}]`, 'must be a nonempty string')
      }
    })
    const [command] = value
    if (typeof command === 'string' && /\s/.test(command)) {
      this.fail(
        `${path}[0]`,
        'contains whitespace. argv is executed without a shell: give one argument per element',
      )
    }
  }

  readonly prerequisites = (value: unknown, path: string): void => {
    const shape = this.object(value, path, [], ['env', 'commands'])
    if (!shape) {
      return
    }
    if (shape.env !== undefined && this.array(shape.env, `${path}.env`)) {
      shape.env.forEach((name, index) => {
        if (typeof name !== 'string' || !ENV_NAME.test(name)) {
          this.fail(`${path}.env[${index}]`, 'must be an environment variable name')
        }
      })
    }
    if (shape.commands !== undefined && this.array(shape.commands, `${path}.commands`)) {
      shape.commands.forEach((name, index) => {
        if (typeof name !== 'string' || name === '' || /[\s/]/.test(name)) {
          this.fail(`${path}.commands[${index}]`, 'must be an executable name found on PATH')
        }
      })
    }
  }

  readonly specializedCi = (shape: Shape, path: string): void => {
    if (shape.ci !== undefined) {
      this.oneOf(shape.ci, `${path}.ci`, CI_MODES)
    }
    if (shape.ci === 'manual') {
      this.reason(shape.reason, `${path}.reason`)
    } else if (shape.reason !== undefined) {
      this.fail(`${path}.reason`, "is only used with ci: 'manual'")
    }
    if (shape.prerequisites !== undefined) {
      this.prerequisites(shape.prerequisites, `${path}.prerequisites`)
    }
  }

  readonly suite = (value: unknown, path: string): void => {
    if (!isRecord(value)) {
      this.fail(path, 'must be an object')
      return
    }
    if (!this.oneOf(value.runner, `${path}.runner`, RUNNERS)) {
      return
    }
    switch (value.runner) {
      case 'vitest':
      case 'jest-expo': {
        const shape = this.object(value, path, ['runner', 'config'], [])
        if (shape) {
          this.relativePath(shape.config, `${path}.config`)
        }
        return
      }
      case 'playwright': {
        const shape = this.object(
          value,
          path,
          ['runner', 'config'],
          ['ci', 'reason', 'browsers', 'prerequisites'],
        )
        if (!shape) {
          return
        }
        this.relativePath(shape.config, `${path}.config`)
        this.specializedCi(shape, path)
        if (shape.browsers !== undefined && this.array(shape.browsers, `${path}.browsers`)) {
          shape.browsers.forEach((browser, index) => {
            this.oneOf(browser, `${path}.browsers[${index}]`, BROWSERS)
          })
        }
        return
      }
      case 'command': {
        const shape = this.object(
          value,
          path,
          ['runner', 'argv', 'report'],
          ['ci', 'reason', 'prerequisites', 'timeoutMinutes'],
        )
        if (!shape) {
          return
        }
        this.argv(shape.argv, `${path}.argv`)
        const report = this.object(shape.report, `${path}.report`, ['format', 'path'], [])
        if (report) {
          this.oneOf(report.format, `${path}.report.format`, REPORT_FORMATS)
          this.relativePath(report.path, `${path}.report.path`)
        }
        this.specializedCi(shape, path)
        if (
          shape.timeoutMinutes !== undefined &&
          (typeof shape.timeoutMinutes !== 'number' ||
            !Number.isInteger(shape.timeoutMinutes) ||
            shape.timeoutMinutes < 1 ||
            shape.timeoutMinutes > 120)
        ) {
          this.fail(`${path}.timeoutMinutes`, 'must be a whole number of minutes from 1 to 120')
        }
      }
    }
  }

  readonly project = (value: unknown, path: string): void => {
    const shape = this.object(
      value,
      path,
      ['name', 'root', 'kind', 'runtime', 'tsconfig'],
      ['dependsOn', 'react', 'suites', 'noUnitTests', 'build'],
    )
    if (!shape) {
      return
    }
    if (this.string(shape.name, `${path}.name`) && !NAME.test(shape.name)) {
      this.fail(`${path}.name`, 'must be lowercase letters, digits, ".", "_" or "-"')
    }
    this.relativePath(shape.root, `${path}.root`)
    this.oneOf(shape.kind, `${path}.kind`, PROJECT_KINDS)
    this.oneOf(shape.runtime, `${path}.runtime`, RUNTIMES)
    this.relativePath(shape.tsconfig, `${path}.tsconfig`)
    if (shape.dependsOn !== undefined && this.array(shape.dependsOn, `${path}.dependsOn`)) {
      shape.dependsOn.forEach((name, index) => {
        this.string(name, `${path}.dependsOn[${index}]`)
      })
    }
    if (shape.react !== undefined) {
      const react = this.object(shape.react, `${path}.react`, ['adapter'], ['minimumVersion'])
      if (react) {
        this.oneOf(react.adapter, `${path}.react.adapter`, REACT_ADAPTERS)
        if (react.minimumVersion !== undefined) {
          this.oneOf(react.minimumVersion, `${path}.react.minimumVersion`, REACT_MINIMUM_VERSIONS)
        }
      }
      if (shape.runtime === 'node') {
        this.fail(`${path}.react`, "a React profile needs runtime 'dom', 'native' or 'universal'")
      }
    }
    let unitSuites = 0
    if (shape.suites !== undefined) {
      if (!isRecord(shape.suites) || Object.keys(shape.suites).length === 0) {
        this.fail(`${path}.suites`, 'must be an object with at least one suite')
      } else {
        for (const [name, suite] of Object.entries(shape.suites)) {
          if (!NAME.test(name)) {
            this.fail(
              `${path}.suites.${name}`,
              'suite names are lowercase letters, digits, ".", "_" or "-"',
            )
          }
          this.suite(suite, `${path}.suites.${name}`)
          if (isRecord(suite) && (suite.runner === 'vitest' || suite.runner === 'jest-expo')) {
            unitSuites += 1
          }
        }
      }
    }
    if (shape.noUnitTests !== undefined) {
      const reason = this.object(shape.noUnitTests, `${path}.noUnitTests`, ['reason'], [])
      if (reason) {
        this.reason(reason.reason, `${path}.noUnitTests.reason`)
      }
      if (unitSuites > 0) {
        this.fail(`${path}.noUnitTests`, 'contradicts a declared unit suite; remove one of them')
      }
    } else if (unitSuites === 0) {
      this.fail(
        `${path}.suites`,
        'declares no vitest or jest-expo suite. Add one, or declare noUnitTests: { reason } explaining why',
      )
    }
    if (shape.runtime === 'native' && isRecord(shape.suites)) {
      for (const [name, suite] of Object.entries(shape.suites)) {
        if (isRecord(suite) && suite.runner === 'vitest') {
          this.fail(
            `${path}.suites.${name}.runner`,
            "native projects test with 'jest-expo', not Vitest/jsdom",
          )
        }
      }
    }
    if (shape.build !== undefined) {
      const build = this.object(shape.build, `${path}.build`, ['argv', 'outputs'], [])
      if (build) {
        this.argv(build.argv, `${path}.build.argv`)
        if (this.array(build.outputs, `${path}.build.outputs`)) {
          build.outputs.forEach((output, index) => {
            this.relativePath(output, `${path}.build.outputs[${index}]`)
          })
        }
      }
    }
  }

  readonly exception = (value: unknown, path: string, today: string): void => {
    const shape = this.object(value, path, ['rule', 'files', 'reason'], ['issue', 'expires'])
    if (!shape) {
      return
    }
    if (this.string(shape.rule, `${path}.rule`) && (shape.rule === '*' || /\s/.test(shape.rule))) {
      this.fail(`${path}.rule`, 'must name exactly one rule')
    }
    this.globs(shape.files, `${path}.files`)
    this.reason(shape.reason, `${path}.reason`)
    if (
      shape.issue !== undefined &&
      this.string(shape.issue, `${path}.issue`) &&
      !/^https:\/\//.test(shape.issue)
    ) {
      this.fail(`${path}.issue`, 'must be an https URL')
    }
    if (shape.expires !== undefined) {
      if (
        typeof shape.expires !== 'string' ||
        !ISO_DATE.test(shape.expires) ||
        Number.isNaN(Date.parse(shape.expires))
      ) {
        this.fail(`${path}.expires`, 'must be a date written YYYY-MM-DD')
      } else if (shape.expires < today) {
        this.fail(
          `${path}.expires`,
          `expired on ${shape.expires}. Fix the code or renew the exception with its reason`,
        )
      }
    }
  }
}

export interface ValidationOptions {
  /** Today's date as `YYYY-MM-DD`, for exception expiry. */
  today?: string
}

/** Every structural problem in a configuration value, in document order. */
export const validateConfigShape = (
  value: unknown,
  { today }: ValidationOptions = {},
): Array<Issue> => {
  const v = new Validator()
  const shape = v.object(
    value,
    '',
    ['schemaVersion', 'root', 'projects', 'ci'],
    ['tooling', 'generated', 'formatIgnore', 'exceptions', 'engine', 'agents'],
  )
  if (!shape) {
    return v.issues
  }
  if (shape.schemaVersion !== undefined && shape.schemaVersion !== 1) {
    v.fail('schemaVersion', 'must be exactly 1')
  }
  if (
    shape.root !== undefined &&
    (typeof shape.root !== 'string' || !shape.root.startsWith('file:'))
  ) {
    v.fail('root', 'must be import.meta.url of the configuration module')
  }
  if (shape.projects !== undefined && v.array(shape.projects, 'projects')) {
    shape.projects.forEach((project, index) => {
      v.project(project, `projects[${index}]`)
    })
  }
  if (shape.tooling !== undefined) {
    const tooling = v.object(shape.tooling, 'tooling', ['files', 'tsconfig'], [])
    if (tooling) {
      if (v.array(tooling.files, 'tooling.files')) {
        tooling.files.forEach((glob, index) => {
          v.relativePath(glob, `tooling.files[${index}]`)
        })
      }
      v.relativePath(tooling.tsconfig, 'tooling.tsconfig')
    }
  }
  if (shape.generated !== undefined) {
    v.reasonedFiles(shape.generated, 'generated')
  }
  if (shape.formatIgnore !== undefined) {
    v.reasonedFiles(shape.formatIgnore, 'formatIgnore')
  }
  if (
    shape.exceptions !== undefined &&
    v.array(shape.exceptions, 'exceptions', { nonEmpty: false })
  ) {
    const date = today ?? new Date().toISOString().slice(0, 10)
    shape.exceptions.forEach((exception, index) => {
      v.exception(exception, `exceptions[${index}]`, date)
    })
  }
  if (shape.ci !== undefined) {
    const ci = v.object(shape.ci, 'ci', ['node'], ['externalSuites'])
    if (ci) {
      v.string(ci.node, 'ci.node')
      if (
        ci.externalSuites !== undefined &&
        v.array(ci.externalSuites, 'ci.externalSuites', { nonEmpty: false })
      ) {
        ci.externalSuites.forEach((entry, index) => {
          const at = `ci.externalSuites[${index}]`
          const external = v.object(entry, at, ['project', 'suite', 'job'], [])
          if (!external) {
            return
          }
          v.string(external.project, `${at}.project`)
          v.string(external.suite, `${at}.suite`)
          if (v.string(external.job, `${at}.job`) && !JOB_ID.test(external.job)) {
            v.fail(`${at}.job`, 'must be a valid GitHub Actions job ID')
          }
          if (external.job === 'quality' || external.job === 'standards') {
            v.fail(`${at}.job`, `"${external.job}" is reserved for the generated caller`)
          }
        })
      }
    }
  }
  if (shape.engine !== undefined) {
    const engine = v.object(
      shape.engine,
      'engine',
      ['contract', 'integrationFiles'],
      ['compatibilityFiles', 'origins'],
    )
    if (engine) {
      v.string(engine.contract, 'engine.contract')
      v.globs(engine.integrationFiles, 'engine.integrationFiles')
      if (engine.compatibilityFiles !== undefined) {
        v.reasonedFiles(engine.compatibilityFiles, 'engine.compatibilityFiles')
      }
      if (engine.origins !== undefined && v.array(engine.origins, 'engine.origins')) {
        engine.origins.forEach((origin, index) => {
          let parsed: URL | undefined
          try {
            parsed = typeof origin === 'string' ? new URL(origin) : undefined
          } catch {
            parsed = undefined
          }
          if (!parsed || parsed.origin !== origin || parsed.protocol !== 'https:') {
            v.fail(
              `engine.origins[${index}]`,
              'must be an https origin such as https://api.toolpath.com',
            )
          }
        })
      }
    }
  }
  if (shape.agents !== undefined) {
    const agents = v.object(shape.agents, 'agents', [], ['skillsDir'])
    if (agents?.skillsDir !== undefined) {
      v.relativePath(agents.skillsDir, 'agents.skillsDir')
    }
  }
  return v.issues
}
