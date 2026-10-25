import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AGENTS_BLOCK_ID,
  AGENTS_FILE,
  agentFileAssets,
  agentsBlock,
  type AgentSelection,
} from '../../src/agents/catalog.js'
import { isExternalDestination, linkDestinations } from '../../src/agents/links.js'
import prettierConfig from '../../src/prettier/index.js'
import { findBlock, upsertBlock } from '../../src/sync/blocks.js'

const packageRoot = fileURLToPath(new URL('../../', import.meta.url))
const INSTALLED = 'node_modules/@toolpath/dev-config'

const selection = (overrides: Partial<AgentSelection> = {}): AgentSelection => ({
  engine: false,
  skillsDir: '.claude/skills',
  packageManager: 'pnpm',
  ...overrides,
})

const LOCAL_INSTRUCTIONS =
  '# Working in this repository\n\nRun the integration suite before a release.\n'

/** The repository's `AGENTS.md` as synchronization writes it: local text, then the managed section. */
const agentsFile = (chosen: AgentSelection): string =>
  upsertBlock(LOCAL_INSTRUCTIONS, 'markdown', AGENTS_BLOCK_ID, agentsBlock(chosen))

const temporaryDirectories: Array<string> = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

/** A disposable repository with this package installed in `node_modules` and the selection's assets written. */
const installInto = (chosen: AgentSelection): string => {
  const root = mkdtempSync(join(tmpdir(), 'toolpath-dev-agents-'))
  temporaryDirectories.push(root)
  mkdirSync(join(root, 'node_modules/@toolpath'), { recursive: true })
  symlinkSync(packageRoot, join(root, INSTALLED), 'dir')
  for (const asset of agentFileAssets(chosen)) {
    mkdirSync(dirname(join(root, asset.target)), { recursive: true })
    writeFileSync(join(root, asset.target), asset.content)
  }
  writeFileSync(join(root, AGENTS_FILE), agentsFile(chosen))
  return root
}

/** Relative links in an installed file, each with whether it resolves from that file. */
const relativeLinks = (
  root: string,
  file: string,
  markdown: string,
): Array<{ link: string; resolves: boolean }> =>
  linkDestinations(markdown)
    .map((link) => link.destination)
    .filter((destination) => !isExternalDestination(destination))
    .map((link) => ({
      link,
      resolves: existsSync(join(root, dirname(file), link.split('#')[0] ?? '')),
    }))

describe('agentFileAssets', () => {
  it('installs each skill as one file under the default Claude skills directory', () => {
    expect(agentFileAssets(selection()).map((asset) => asset.target)).toEqual([
      '.claude/skills/commit/SKILL.md',
      '.claude/skills/pr/SKILL.md',
      '.claude/skills/review/SKILL.md',
    ])
  })

  it('installs under an explicit repository-relative skills directory', () => {
    expect(
      agentFileAssets(selection({ skillsDir: 'tools/agents/skills/' })).map(
        (asset) => asset.target,
      ),
    ).toEqual([
      'tools/agents/skills/commit/SKILL.md',
      'tools/agents/skills/pr/SKILL.md',
      'tools/agents/skills/review/SKILL.md',
    ])
  })

  it.each([
    ['.claude/skills', '../../../node_modules/@toolpath/dev-config/assets/agents/AGENTS.md'],
    [
      'tools/agents/skills',
      '../../../../node_modules/@toolpath/dev-config/assets/agents/AGENTS.md',
    ],
  ])(
    'points package links from %s into the installed package and keeps sibling skill links',
    (skillsDir, expected) => {
      const pr = agentFileAssets(selection({ skillsDir })).find((asset) =>
        asset.target.endsWith('/pr/SKILL.md'),
      )
      expect(pr?.content).toContain(`](${expected})`)
      expect(pr?.content).toContain('](../commit/SKILL.md)')
      expect(pr?.content).toContain('](../review/SKILL.md)')
    },
  )

  it.each([
    '/srv/skills',
    '../skills',
    'tools/../../skills',
    '',
    '.',
    'C:/skills',
    'tools\\skills',
  ])('rejects the skills directory %j, which is not inside the repository', (skillsDir) => {
    expect(() => agentFileAssets(selection({ skillsDir }))).toThrow(/inside the repository/)
    expect(() => agentsBlock(selection({ skillsDir }))).toThrow(/inside the repository/)
  })
})

describe('agentsBlock', () => {
  it('keeps the Engine context out unless the Engine profile is selected', () => {
    const generic = agentsBlock(selection())
    const engine = agentsBlock(selection({ engine: true }))
    expect(generic).not.toMatch(/Engine/)
    expect(engine).toContain(`](${INSTALLED}/assets/engine/agents/AGENTS.md)`)
    expect(engine.startsWith(generic.trimEnd())).toBe(true)
  })

  it.each([
    ['pnpm', 'pnpm exec toolpath-dev check'],
    ['npm', 'npx toolpath-dev check'],
  ] as const)('writes %s commands', (packageManager, command) => {
    const block = agentsBlock(selection({ packageManager }))
    expect(block).toContain(`\`${command} --project <name>\``)
    expect(block).toContain(`\`${command}\``)
  })

  it('links the installed skills from the skills directory the repository chose', () => {
    expect(agentsBlock(selection({ skillsDir: 'tools/agents/skills' }))).toContain(
      '[commit](tools/agents/skills/commit/SKILL.md)',
    )
  })

  it('reads back from AGENTS.md as exactly the block it wrote', () => {
    const block = agentsBlock(selection({ engine: true }))
    expect(
      findBlock(agentsFile(selection({ engine: true })), 'markdown', AGENTS_BLOCK_ID)?.content,
    ).toBe(block)
  })
})

describe('installed agent assets', () => {
  it.each([
    selection(),
    selection({ engine: true, packageManager: 'npm' }),
    selection({ skillsDir: 'tools/agents/skills', engine: true }),
  ])('resolve every relative link after installation (%o)', (chosen) => {
    const root = installInto(chosen)
    const files = [
      ...agentFileAssets(chosen).map((asset) => ({ path: asset.target, content: asset.content })),
      { path: AGENTS_FILE, content: agentsFile(chosen) },
    ]
    const links = files.flatMap((file) => relativeLinks(root, file.path, file.content))
    expect(links.length).toBeGreaterThan(5)
    expect(links.filter((link) => !link.resolves)).toEqual([])
  })

  it('are byte-identical on every call, so a repeated sync writes nothing', () => {
    const chosen = selection({ engine: true })
    expect(JSON.stringify(agentFileAssets(chosen))).toBe(JSON.stringify(agentFileAssets(chosen)))
    expect(agentsBlock(chosen)).toBe(agentsBlock(chosen))
  })

  it.each([
    selection(),
    selection({ engine: true, skillsDir: 'tools/agents/skills', packageManager: 'npm' }),
  ])('are already formatted the way the pre-commit hook formats them (%o)', async (chosen) => {
    for (const asset of agentFileAssets(chosen)) {
      expect(await format(asset.content, { ...prettierConfig, filepath: asset.target })).toBe(
        asset.content,
      )
    }
    const file = agentsFile(chosen)
    expect(await format(file, { ...prettierConfig, filepath: AGENTS_FILE })).toBe(file)
  })
})
