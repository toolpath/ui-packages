/**
 * The release workflow runs on a path filter, and a path filter is a roster:
 * it goes stale the moment a package is added, and it fails silently — the
 * merge succeeds, CI is green, and nothing publishes.
 *
 * Two ways it has been wrong:
 *
 * - **A Changeset alone did not trigger it.** `.changeset/**` was not listed, so
 *   a pull request whose only release-relevant content was a Changeset merged to
 *   `main` and no release run started. That is exactly the shape of a republish
 *   — `@toolpath/app-support@0.1.1` fixed a manifest and touched no package
 *   source — and the Changeset then sat on `main` indefinitely, because the next
 *   release is only triggered by somebody else's unrelated change.
 * - **A new package's paths have to be added by hand.** `packages/app-support/`
 *   needed two lines here that nothing would have asked for.
 *
 * So the roster is checked against the workspace rather than trusted: every
 * package `changeset publish` will publish must have its `src/**` and its
 * manifest in the filter, and `.changeset/**` must be there because a Changeset
 * is the release intent itself.
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './lib.mjs'

const workflow = '.github/workflows/release.yml'
const registry = 'https://registry.npmjs.org'
const source = await readFile(join(repositoryRoot, workflow), 'utf8')

/**
 * The `paths:` list of the `push` trigger.
 *
 * Read by indentation rather than with a YAML parser, which this repository does
 * not depend on. The block ends at the first line that is not one of its items.
 */
const triggerPaths = () => {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => /^\s{4}paths:\s*$/.test(line))
  if (start < 0) return []
  const found = []
  for (const line of lines.slice(start + 1)) {
    const item = /^\s{6}-\s+(\S+)\s*$/.exec(line)
    if (!item) break
    found.push(item[1])
  }
  return found
}

const paths = triggerPaths()
const faults = []

// Guards every rule below: a workflow this failed to parse would find no paths
// and report each package as missing, or — worse, if the rules were written the
// other way round — report nothing and pass.
if (paths.length === 0) {
  faults.push(
    `No push path filter was found in ${workflow}. Either the trigger changed shape or this ` +
      `check can no longer read it; it is proving nothing as written.`,
  )
}

if (paths.length > 0 && !paths.includes('.changeset/**')) {
  faults.push(
    `${workflow} does not run on \`.changeset/**\`. A Changeset is the release intent, and a ` +
      `pull request that carries one without touching package source — a republish, a manifest ` +
      `fix — merges to main and starts no release.`,
  )
}

/** What `changeset publish` will push to npm, and so what has to trigger the workflow. */
for (const entry of await readdir(join(repositoryRoot, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  let manifest
  try {
    manifest = JSON.parse(
      await readFile(join(repositoryRoot, 'packages', entry.name, 'package.json'), 'utf8'),
    )
  } catch (error) {
    if (error.code === 'ENOENT') continue
    throw error
  }
  if (manifest.private || manifest.publishConfig?.registry !== registry) continue
  if (paths.length === 0) continue

  for (const required of [`packages/${entry.name}/src/**`, `packages/${entry.name}/package.json`]) {
    if (!paths.includes(required)) {
      faults.push(
        `${manifest.name} is published to npm, but ${workflow} does not run on ${required}. ` +
          `A change there would merge to main and publish nothing.`,
      )
    }
  }
}

if (faults.length > 0) {
  process.stderr.write(
    `The release trigger is incomplete:\n\n${faults.map((f) => `  - ${f}`).join('\n')}\n`,
  )
  process.exit(1)
}

process.stdout.write(
  `Verified ${workflow} runs on .changeset/** and on every published package’s source and manifest\n`,
)
