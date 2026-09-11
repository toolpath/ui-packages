/**
 * `release:npm` builds each package by hand, and the order it names them in is
 * load bearing.
 *
 * A package that imports a workspace sibling resolves that sibling through a
 * link to its source directory, and reads its types out of the `dist` the
 * sibling's own build produces. Built in the wrong order there is no `dist` yet,
 * and a declaration build fails with TS2307 on a package that compiles
 * perfectly well — which is what shipped `@toolpath/tool-support` after the two
 * packages that import it, and left `@toolpath/ui`, `@toolpath/tool-drawing` and
 * `@toolpath/tool-scraper` versioned but unpublished when the chain exited
 * before `changeset publish`.
 *
 * **Nothing else covers this.** `pnpm build` and `pnpm check` go through
 * `turbo run build`, whose `dependsOn: ["^build"]` derives the order from the
 * workspace graph and so is always right. `release:npm` states the order
 * literally, and it runs only on `main` after a release pull request merges —
 * so its first execution is the release it breaks.
 *
 * The graph is read from the manifests rather than listed here, so an edge added
 * between two packages is covered without anybody remembering this file exists.
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './lib.mjs'

const registry = 'https://registry.npmjs.org'

/**
 * Root scripts that build exactly one package without naming it in a `--filter`.
 *
 * The only part of this check that is a list, because the mapping is not
 * derivable from the script name. Each is asserted to still exist below, so
 * renaming one fails here rather than quietly dropping its package from the
 * order.
 */
const aliasedBuilds = {
  'package:typescript-sdk': '@toolpath/api',
  'build:ui': '@toolpath/ui',
  'build:viewer': '@toolpath/viewer',
}

const rootManifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
const releaseScript = rootManifest.scripts?.['release:npm']
if (!releaseScript) {
  throw new Error('No release:npm script in the root package.json; this check needs rewriting.')
}

for (const alias of Object.keys(aliasedBuilds)) {
  if (!rootManifest.scripts?.[alias]) {
    throw new Error(
      `This check maps the root script ${alias} onto ${aliasedBuilds[alias]}, but no such script ` +
        `exists any more. Update aliasedBuilds in scripts/check-release-build-order.mjs.`,
    )
  }
}

/** Every workspace package under `packages/`, by name. */
const manifests = new Map()
for (const entry of await readdir(join(repositoryRoot, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  try {
    const manifest = JSON.parse(
      await readFile(join(repositoryRoot, 'packages', entry.name, 'package.json'), 'utf8'),
    )
    if (manifest.name) manifests.set(manifest.name, manifest)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

const steps = releaseScript.split('&&').map((step) => step.trim())

/** Where each package is built, as an index into the chain. */
const builtAt = new Map()
steps.forEach((step, index) => {
  const filtered = /^pnpm\s+--filter\s+(\S+)\s+build$/.exec(step)
  if (filtered) {
    builtAt.set(filtered[1], index)
    return
  }
  const aliased = /^pnpm\s+(\S+)$/.exec(step)
  if (aliased && aliasedBuilds[aliased[1]]) {
    builtAt.set(aliasedBuilds[aliased[1]], index)
  }
})

const publishAt = steps.findIndex((step) => step.includes('changeset publish'))

const faults = []

if (publishAt < 0) {
  faults.push('release:npm never reaches `changeset publish`.')
}

// Guards every rule below: a script this check failed to parse would find no
// builds and report that as a pass, which is the failure mode it exists against.
if (builtAt.size === 0) {
  faults.push(
    'No package builds were recognised in release:npm. The script’s shape changed and this ' +
      'check is now proving nothing.',
  )
}

/** What `changeset publish` will push to npm, and so what has to be built first. */
const published = [...manifests.values()].filter(
  (manifest) => !manifest.private && manifest.publishConfig?.registry === registry,
)

for (const manifest of published) {
  const at = builtAt.get(manifest.name)
  if (at === undefined) {
    faults.push(
      `${manifest.name} is published to npm but release:npm never builds it, so changeset ` +
        `publish would ship whatever dist happened to be on disk.`,
    )
    continue
  }
  if (publishAt >= 0 && at > publishAt) {
    faults.push(`${manifest.name} is built after \`changeset publish\`, which is too late.`)
  }
}

/** Every `dependent -> dependency` edge between two workspace packages. */
const edges = []
for (const manifest of manifests.values()) {
  for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
    if (manifests.has(dependency) && String(range).startsWith('workspace:')) {
      edges.push([manifest.name, dependency])
    }
  }
}

// The second guard: with no edges there is no order to get wrong, and a check
// that silently stops testing anything is worse than one that is absent.
if (edges.length === 0) {
  faults.push(
    'No workspace dependency edges were found. Either the graph changed shape or this check ' +
      'can no longer read it; it is proving nothing as written.',
  )
}

for (const [dependent, dependency] of edges) {
  const dependentAt = builtAt.get(dependent)
  const dependencyAt = builtAt.get(dependency)
  if (dependentAt === undefined || dependencyAt === undefined) continue
  if (dependencyAt > dependentAt) {
    faults.push(
      `${dependent} imports ${dependency}, but release:npm builds ${dependency} after it. ` +
        `A declaration build of ${dependent} fails with TS2307 because ${dependency} has no ` +
        `dist yet. Move the ${dependency} build ahead of the ${dependent} one.`,
    )
  }
}

if (faults.length > 0) {
  process.stderr.write(
    `release:npm build order is wrong:\n\n${faults.map((f) => `  - ${f}`).join('\n')}\n`,
  )
  process.exit(1)
}

process.stdout.write(
  `Verified release:npm builds ${published.length} published packages in an order that respects ` +
    `${edges.length} workspace dependency ${edges.length === 1 ? 'edge' : 'edges'}\n`,
)
