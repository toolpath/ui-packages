/**
 * Exit codes are a contract: `0` success, `1` a check found a defect, `2` the
 * invocation, configuration, or a prerequisite is wrong. An interrupted child
 * keeps a nonzero outcome; a signal never becomes success.
 */
export const EXIT_SUCCESS = 0
export const EXIT_CHECK_FAILURE = 1
export const EXIT_USAGE = 2

export interface Issue {
  /** Where the problem is: a config path such as `projects[1].suites.unit`, or a file. */
  path: string
  message: string
}

/** Invalid invocation, configuration, or a missing prerequisite. Exit code 2. */
export class UsageError extends Error {
  readonly exitCode: number = EXIT_USAGE
  readonly issues: ReadonlyArray<Issue>

  constructor(message: string, issues: ReadonlyArray<Issue> = []) {
    super(issues.length > 0 ? `${message}\n${formatIssues(issues)}` : message)
    this.name = 'UsageError'
    this.issues = issues
  }
}

/** A configuration that does not satisfy the schema or the repository. */
export class ConfigError extends UsageError {
  constructor(message: string, issues: ReadonlyArray<Issue> = []) {
    super(message, issues)
    this.name = 'ConfigError'
  }
}

/** A tool, browser, service, or environment value a selected command needs. */
export class PrerequisiteError extends UsageError {
  constructor(message: string, issues: ReadonlyArray<Issue> = []) {
    super(message, issues)
    this.name = 'PrerequisiteError'
  }
}

/** A selected profile's optional peer is not installed. */
export class MissingPeerError extends PrerequisiteError {
  constructor(
    profile: string,
    packages: ReadonlyArray<string>,
    versions: Readonly<Record<string, string>>,
  ) {
    const specs = packages.map((name) => `${name}@${versions[name] ?? ''}`.replace(/@$/, ''))
    super(
      `The ${profile} profile needs ${packages.join(', ')}, which ${packages.length === 1 ? 'is' : 'are'} not installed.\n` +
        `Install the tested version${packages.length === 1 ? '' : 's'} as exact dev dependencies:\n` +
        `  npm install --save-dev --save-exact ${specs.join(' ')}\n` +
        `  pnpm add --save-dev --save-exact ${specs.join(' ')}`,
    )
    this.name = 'MissingPeerError'
  }
}

/** A check ran and found a defect. Exit code 1. */
export class CheckFailure extends Error {
  readonly exitCode: number = EXIT_CHECK_FAILURE

  constructor(message: string) {
    super(message)
    this.name = 'CheckFailure'
  }
}

export const formatIssues = (issues: ReadonlyArray<Issue>): string =>
  issues.map((issue) => `  - ${issue.path}: ${issue.message}`).join('\n')
