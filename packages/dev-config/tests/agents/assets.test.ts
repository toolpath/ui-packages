import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { agentsBlock } from '../../src/agents/catalog.js'
import { isExternalDestination, linkDestinations } from '../../src/agents/links.js'
import { toolchain } from '../../src/policy/toolchain.js'

const packageRoot = fileURLToPath(new URL('../../', import.meta.url))
const read = (path: string): string => readFileSync(join(packageRoot, path), 'utf8')

/** Package-relative paths of every file under `directory`. */
const filesUnder = (directory: string): Array<string> =>
  readdirSync(join(packageRoot, directory), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`],
  )

/** A Markdown file's YAML frontmatter as a plain object. */
const frontmatter = (path: string): Record<string, unknown> => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(read(path))
  const value: unknown = match?.[1] === undefined ? undefined : parse(match[1])
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} has no frontmatter object`)
  }
  return value as Record<string, unknown>
}

const BOOTSTRAP = 'assets/agents/AGENTS.md'
const ENGINE_CONTEXT = 'assets/engine/agents/AGENTS.md'
const SKILLS = readdirSync(join(packageRoot, 'assets/agents/skills')).sort()
const GENERIC_FILES = filesUnder('assets/agents')
const ALL_ASSETS = filesUnder('assets')

/** Product vocabulary the generic guidance and skills must not assume. */
const PRODUCT_DOMAIN =
  /\b(?:Engine|machining|toolpaths|quot(?:e|es|ing)|holders?|partId|jobUuid|reportId|Mastercam|Fusion|viewer)\b|\b(?:CAD|CAM|DFM|SDK)\b|@toolpath\/api\b|toolpath\.com/
/** Applications that adopt the standard; assets never name one. */
const CONSUMER_NAMES =
  /quoting-ui|cad-viewer|kennametal|toolpath-template|toolpath\/services|\bui-packages\b/i
/** Ways of running a formatter by hand, which the standard never asks for. */
const MANUAL_FORMATTING =
  /prettier\s+--(?:write|check)|\bnpx\s+prettier\b|\b(?:npm|pnpm)\s+(?:run\s+)?format(?::check)?\b|\bformat:check\b/

describe('shared working standard', () => {
  it('stays within 80 lines', () => {
    expect(read(BOOTSTRAP).trimEnd().split('\n').length).toBeLessThanOrEqual(80)
  })

  it.each(['toolpath-dev check', 'lint', 'check-types', 'test', 'toolpath-dev doctor'])(
    'names the standard command %s',
    (command) => {
      expect(read(BOOTSTRAP)).toContain(command)
    },
  )

  it('states that formatting is automatic', () => {
    expect(read(BOOTSTRAP)).toMatch(/Formatting is automatic/)
    expect(
      agentsBlock({ engine: false, skillsDir: '.claude/skills', packageManager: 'npm' }),
    ).toMatch(/Formatting is automatic/)
  })
})

describe('agent assets', () => {
  it.each(ALL_ASSETS.filter((path) => path.endsWith('.md')))(
    '%s never asks for a manual formatter or format check',
    (path) => {
      expect(read(path)).not.toMatch(MANUAL_FORMATTING)
    },
  )

  it.each(GENERIC_FILES)('%s assumes no product domain', (path) => {
    expect(read(path)).not.toMatch(PRODUCT_DOMAIN)
  })

  it('keeps the generic managed section free of product domain', () => {
    expect(
      agentsBlock({ engine: false, skillsDir: '.claude/skills', packageManager: 'pnpm' }),
    ).not.toMatch(PRODUCT_DOMAIN)
  })

  it.each(ALL_ASSETS)('%s names no consuming application', (path) => {
    expect(read(path)).not.toMatch(CONSUMER_NAMES)
  })

  it.each(ALL_ASSETS.filter((path) => path.endsWith('.md')))(
    '%s links only to files that exist in the package',
    (path) => {
      const missing = linkDestinations(read(path))
        .map((link) => link.destination)
        .filter((destination) => !isExternalDestination(destination))
        .filter(
          (destination) =>
            !existsSync(join(packageRoot, dirname(path), destination.split('#')[0] ?? '')),
        )
      expect(missing).toEqual([])
    },
  )
})

describe('skills', () => {
  it('ships commit, pr, and review', () => {
    expect(SKILLS).toEqual(['commit', 'pr', 'review'])
  })

  it.each(SKILLS)('%s has valid Claude skill frontmatter named after its directory', (skill) => {
    const fields = frontmatter(`assets/agents/skills/${skill}/SKILL.md`)
    expect(
      Object.keys(fields).filter((key) => !['name', 'description', 'argument-hint'].includes(key)),
    ).toEqual([])
    expect(fields.name).toBe(skill)
    expect(fields.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    expect(typeof fields.description).toBe('string')
    expect(String(fields.description).length).toBeGreaterThan(40)
    expect(String(fields.description).length).toBeLessThanOrEqual(1536)
    expect(['undefined', 'string']).toContain(typeof fields['argument-hint'])
  })

  it('keeps review read-only unless the user asks otherwise', () => {
    expect(read('assets/agents/skills/review/SKILL.md')).toMatch(
      /Review only\. Do not modify files, commit, launch another review, or post comments or reviews to GitHub unless the user explicitly asks/,
    )
  })

  it('has review report its evidence and the exact revision it read', () => {
    const review = read('assets/agents/skills/review/SKILL.md')
    expect(review).toMatch(/the evidence/)
    expect(review).toMatch(/exact revisions/)
  })

  it('keeps a pull request a draft when the user asks for one', () => {
    const pr = read('assets/agents/skills/pr/SKILL.md')
    expect(pr).toMatch(
      /Keep the PR a draft when the user requests one, including after every check passes\./,
    )
    expect(pr).toMatch(/Mark a completed draft ready only when the user did not ask for a draft\./)
  })

  it('has commits made through the hooks, never around them', () => {
    expect(read('assets/agents/skills/commit/SKILL.md')).toMatch(
      /never bypass a failed hook with\s+`--no-verify`/,
    )
  })
})

describe('Engine integration context', () => {
  const context = read(ENGINE_CONTEXT)

  it('keeps the domain model first, patterns next, and sources last', () => {
    const order = [
      '## Domain model',
      '## Contracts, SDKs, and deployments',
      '## Integration patterns',
      '## Documentation and sources',
    ].map((heading) => context.indexOf(heading))
    expect(order.every((position) => position >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it.each(Object.entries(toolchain.engine.contracts))(
    'states the pinned contract and SDK of %s',
    (_id, pin) => {
      expect(context).toContain(`\`${pin.apiVersion}\``)
      expect(context).toContain(`@toolpath/api@${pin.sdk}`)
    },
  )

  it('names both public deployments', () => {
    expect(context).toContain(toolchain.engine.origins.production)
    expect(context).toContain(toolchain.engine.origins.staging)
  })

  it('keeps the upload key boundary and SDK ownership explicit', () => {
    expect(context).toMatch(/never send the Engine API key to the upload host/)
    expect(context).toMatch(/A deficiency in them belongs in the SDK as an upstream change/)
  })
})

describe('optional Claude Code files', () => {
  const SUBAGENT_FIELDS = [
    'name',
    'description',
    'tools',
    'disallowedTools',
    'model',
    'effort',
    'permissionMode',
    'skills',
    'color',
  ]
  const TOOLS = [
    'Read',
    'Glob',
    'Grep',
    'Bash',
    'Edit',
    'Write',
    'WebFetch',
    'WebSearch',
    'Skill',
    'NotebookEdit',
  ]

  it('defines one worker that defaults to Opus at high effort', () => {
    const worker = frontmatter('assets/claude-code/agents/worker.md')
    expect(Object.keys(worker).filter((key) => !SUBAGENT_FIELDS.includes(key))).toEqual([])
    expect(worker.name).toBe('worker')
    expect(typeof worker.description).toBe('string')
    expect(worker.model).toBe('opus')
    expect(worker.effort).toBe('high')
    expect(
      String(worker.tools)
        .split(',')
        .map((tool) => tool.trim())
        .filter((tool) => !TOOLS.includes(tool)),
    ).toEqual([])
  })

  it('defines the Orchestrator output style the launch command selects', () => {
    const style = frontmatter('assets/claude-code/output-styles/orchestrator.md')
    expect(Object.keys(style).sort()).toEqual(['description', 'keep-coding-instructions', 'name'])
    expect(style['keep-coding-instructions']).toBe(true)
    const selected = /"outputStyle":"([^"]+)"/.exec(read('assets/claude-code/install.sh'))?.[1]
    expect(selected).toBe(style.name)
    expect(read('assets/claude-code/output-styles/orchestrator.md')).toContain('**`worker`**')
  })

  it('ships only the worker, the style, and the installer', () => {
    expect(filesUnder('assets/claude-code').sort()).toEqual([
      'assets/claude-code/agents/worker.md',
      'assets/claude-code/install.sh',
      'assets/claude-code/output-styles/orchestrator.md',
    ])
  })
})
