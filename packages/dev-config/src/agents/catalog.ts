import { readdirSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ConfigError } from '../errors.js'
import { isExternalDestination, rewriteLinkDestinations } from './links.js'

/**
 * The agent assets a repository receives, from their one canonical copy under
 * the package's `assets/`. Skills are installed as whole managed files, the
 * `toolpath-api` skill only with the Engine profile; the shared guidance stays in
 * the installed package and is linked from a managed section of the repository's
 * `AGENTS.md`.
 */

export interface AgentSelection {
  /** Whether the repository selected the Engine integration profile. */
  engine: boolean
  /** Repository-relative skills directory, such as `.claude/skills`. */
  skillsDir: string
  packageManager: 'npm' | 'pnpm'
}

export interface AgentFileAsset {
  /** Repository-relative POSIX path the file is installed at. */
  target: string
  /** The file's final bytes, with relative links rewritten for `target`. */
  content: string
}

export const AGENTS_FILE = 'AGENTS.md'
export const AGENTS_BLOCK_ID = 'toolpath-dev-standard'

/** Where the package is installed in a consumer, relative to its root. */
const INSTALLED_PACKAGE = 'node_modules/@toolpath/dev-config'
const SKILLS_SOURCE = 'assets/agents/skills'
const ENGINE_SKILLS_SOURCE = 'assets/engine/skills'
const packageRoot = fileURLToPath(new URL('../../', import.meta.url))

const normalizeSkillsDir = (skillsDir: string): string => {
  const trimmed = skillsDir.trim().replace(/\/+$/, '')
  const normalized = posix.normalize(trimmed)
  if (
    trimmed === '' ||
    trimmed.includes('\\') ||
    posix.isAbsolute(trimmed) ||
    /^[A-Za-z]:/.test(trimmed) ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new ConfigError(
      `--skills-dir ${skillsDir}: give a directory inside the repository, relative to its root, such as .claude/skills.`,
    )
  }
  return normalized
}

/** Files under a package directory, as package-relative POSIX paths, sorted. */
const packageFiles = (directory: string): Array<string> =>
  readdirSync(join(packageRoot, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        return packageFiles(path)
      }
      return entry.isFile() ? [path] : []
    })
    .sort()

/** Where an installed copy of a package file lands, when the file is installed at all. */
const installedTarget = (packagePath: string, skillsDir: string): string | undefined => {
  const source = [SKILLS_SOURCE, ENGINE_SKILLS_SOURCE].find((directory) =>
    packagePath.startsWith(`${directory}/`),
  )
  return source === undefined ? undefined : `${skillsDir}/${packagePath.slice(source.length + 1)}`
}

/** A relative link from repository file `from` to package file `packagePath` as installed. */
const linkTo = (from: string, packagePath: string, skillsDir: string): string =>
  posix.relative(
    posix.dirname(from),
    installedTarget(packagePath, skillsDir) ?? `${INSTALLED_PACKAGE}/${packagePath}`,
  )

/**
 * `markdown` from package file `source`, with its relative links rewritten so
 * they resolve from `target`: links to another installed asset follow it, and
 * links to anything else point into the installed package.
 */
const rewriteFor = (source: string, markdown: string, target: string, skillsDir: string): string =>
  rewriteLinkDestinations(markdown, (destination) => {
    if (isExternalDestination(destination)) {
      return destination
    }
    const hash = destination.indexOf('#')
    const path = hash === -1 ? destination : destination.slice(0, hash)
    const fragment = hash === -1 ? '' : destination.slice(hash)
    const resolved = posix.normalize(posix.join(posix.dirname(source), path))
    if (resolved === '..' || resolved.startsWith('../')) {
      throw new ConfigError(`${source} links outside @toolpath/dev-config: ${destination}`)
    }
    return `${linkTo(target, resolved, skillsDir)}${fragment}`
  })

/** The skills, each installed as a whole managed file under the selected skills directory. */
export const agentFileAssets = (selection: AgentSelection): Array<AgentFileAsset> => {
  const skillsDir = normalizeSkillsDir(selection.skillsDir)
  const sources = selection.engine ? [SKILLS_SOURCE, ENGINE_SKILLS_SOURCE] : [SKILLS_SOURCE]
  return sources
    .flatMap((directory) => packageFiles(directory))
    .map((source) => {
      const target = installedTarget(source, skillsDir) ?? source
      const content = readFileSync(join(packageRoot, source), 'utf8')
      return {
        target,
        content: source.endsWith('.md') ? rewriteFor(source, content, target, skillsDir) : content,
      }
    })
}

/**
 * The managed section of the repository's `AGENTS.md`, without its markers: the
 * workflow-critical rules inline, so they are visible without opening anything,
 * and links to the installed guidance and skills. It starts and ends with a blank
 * line so it sits between its HTML-comment markers exactly as Prettier formats it.
 */
export const agentsBlock = (selection: AgentSelection): string => {
  const skillsDir = normalizeSkillsDir(selection.skillsDir)
  const run = selection.packageManager === 'pnpm' ? 'pnpm exec toolpath-dev' : 'npx toolpath-dev'
  const link = (packagePath: string): string => linkTo(AGENTS_FILE, packagePath, skillsDir)
  const skill = (name: string): string => link(`${SKILLS_SOURCE}/${name}/SKILL.md`)
  const lines = [
    '',
    '## Shared development standard',
    '',
    'This repository follows the shared standard in `@toolpath/dev-config`. `toolpath-dev sync` manages this section; keep project facts and exceptions elsewhere in this file, where they take precedence.',
    '',
    `- Check with \`${run} check --project <name>\` while working and \`${run} check\` before finishing. \`lint\`, \`check-types\`, and \`test\` run one stage; \`doctor\` diagnoses configuration, tools, hooks, and CI wiring.`,
    '- Formatting is automatic: the pre-commit hook applies safe lint fixes and formats staged files, and CI checks formatting without changing anything. Never run a formatter or a format check, and never bypass the hook.',
    '- The lint and type policy is shared. Fix the code; a justified exception is a line-scoped `-- reason` suppression or a narrow `exceptions` entry in `dev.config.mjs`, never a file-wide disable or `@ts-ignore`.',
    '- Declared test suites must run real tests. Do not add `.only`, unexplained skips, retries, or coverage.',
    '- Report every check as passed, failed, or skipped with its reason; a missing prerequisite is not a pass.',
    `- Commit, prepare pull requests, and review with the [commit](${skill('commit')}), [pr](${skill('pr')}), and [review](${skill('review')}) skills.`,
    '',
    `Full guidance: the [shared working standard](${link('assets/agents/AGENTS.md')}) and the [agent assets reference](${link('docs/agents.md')}).`,
  ]
  if (selection.engine) {
    lines.push(
      '',
      `This repository integrates the Toolpath Engine API. Use the [toolpath-api](${link(`${ENGINE_SKILLS_SOURCE}/toolpath-api/SKILL.md`)}) skill before changing Engine code.`,
    )
  }
  return `${lines.join('\n')}\n\n`
}
