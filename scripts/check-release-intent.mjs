import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const baseRef = process.argv[2]
if (!baseRef) {
  throw new Error('Pass the base ref, for example: origin/main')
}

const changedFiles = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)

const releaseSensitivePaths = [
  {
    packageName: '@toolpath/app-support',
    paths: ['packages/app-support/src/'],
  },
  {
    packageName: '@toolpath/ui',
    paths: ['packages/ui/src/', 'packages/ui/tailwind-preset.cjs'],
  },
  {
    packageName: '@toolpath/viewer',
    paths: ['packages/viewer/src/'],
  },
  {
    packageName: '@toolpath/api',
    paths: [
      'packages/sdk-typescript/src/',
      'openapi/',
      'codegen/typescript-fetch.yaml',
      'scripts/generate-sdks.mjs',
    ],
  },
  {
    packageName: '@toolpath/tool-drawing',
    paths: ['packages/tool-drawing/src/'],
  },
  {
    packageName: '@toolpath/tool-scraper',
    paths: ['packages/tool-scraper/src/'],
  },
  {
    packageName: '@toolpath/tool-support',
    paths: ['packages/tool-support/src/'],
  },
]

const affectedPackages = releaseSensitivePaths
  .filter(({ paths }) =>
    changedFiles.some((file) => paths.some((path) => file === path || file.startsWith(path))),
  )
  .map(({ packageName }) => packageName)

if (affectedPackages.length === 0) {
  process.stdout.write('No release-sensitive public package files changed.\n')
  process.exit(0)
}

const changesetFiles = changedFiles.filter(
  (file) =>
    file.startsWith('.changeset/') && file.endsWith('.md') && file !== '.changeset/README.md',
)
const releasedPackages = new Set()

for (const file of changesetFiles) {
  const contents = await readFile(file, 'utf8')
  const frontmatter = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!frontmatter) continue

  for (const match of frontmatter[1].matchAll(/^\s*(?:"([^"]+)"|'([^']+)'|([^\s:]+))\s*:/gm)) {
    releasedPackages.add(match[1] ?? match[2] ?? match[3])
  }
}

const missingPackages = affectedPackages.filter((packageName) => !releasedPackages.has(packageName))
if (missingPackages.length > 0) {
  throw new Error(
    [
      `This PR changes release-sensitive source for: ${missingPackages.join(', ')}.`,
      'Run `pnpm changeset`, select each affected package, and commit the generated file.',
      'If the change intentionally has no consumer-visible impact, ask a maintainer to apply the no-release-needed label.',
    ].join('\n'),
  )
}

process.stdout.write(`Release intent recorded for: ${affectedPackages.join(', ')}.\n`)
