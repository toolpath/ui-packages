/**
 * The bootstrap publish has to produce the same artifact the release publish
 * does, and exactly one thing in the repository decides that: which package
 * manager runs `publish`.
 *
 * A workspace dependency is written `workspace:^` in the manifest. pnpm
 * rewrites it to a real range at pack time; npm does not know the protocol and
 * ships it verbatim, and the published package then fails to install at all
 * with `EUNSUPPORTEDPROTOCOL`. `changeset publish` goes through pnpm, so every
 * ordinary release is correct. `scripts/bootstrap-npm-package.mjs` is the one
 * publish that is not `changeset publish`, and it ran `npm publish`.
 *
 * **Nothing else covers this.** The bootstrap runs once per package, by hand,
 * on a maintainer's machine, and only for a package npm has never seen — so
 * its first execution is the publish it breaks, and the break is permanent
 * because npm will not accept a second upload of a version. It cost
 * `@toolpath/app-support@0.1.0`, the first bootstrapped package that had a
 * workspace dependency to get wrong.
 *
 * The publisher is read out of the script rather than asserted about the
 * registry, because the failure is in an artifact that only exists after an
 * irreversible action.
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './lib.mjs'

const script = 'scripts/bootstrap-npm-package.mjs'
const source = await readFile(join(repositoryRoot, script), 'utf8')

const faults = []

/** Every `run('<manager>', ['publish', …])` the bootstrap makes. */
const publishes = [...source.matchAll(/run\(\s*'([^']+)'\s*,\s*\[\s*'publish'/g)].map((m) => m[1])

// Guards the rule below: a script that stopped matching would find no publishes
// and report that as a pass, which is the failure mode this check exists
// against.
if (publishes.length === 0) {
  faults.push(
    `No publish invocation was found in ${script}. Either it no longer publishes or this ` +
      `check can no longer read it; it is proving nothing as written.`,
  )
}

for (const manager of publishes) {
  if (manager !== 'pnpm') {
    faults.push(
      `${script} publishes with \`${manager}\`. Only pnpm rewrites a \`workspace:\` range to a ` +
        `real one at pack time — ${manager} ships the protocol verbatim and the published ` +
        `package fails to install with EUNSUPPORTEDPROTOCOL.`,
    )
  }
}

/**
 * The other half of the claim: that a `workspace:` range is still something a
 * published package can carry. If no published manifest has one, the rule above
 * is about a hazard that no longer exists and should be deleted rather than
 * left standing as decoration.
 */
const registry = 'https://registry.npmjs.org'
const carriers = []
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
  const workspaceRanges = Object.entries(manifest.dependencies ?? {}).filter(([, range]) =>
    String(range).startsWith('workspace:'),
  )
  if (workspaceRanges.length > 0) carriers.push(manifest.name)
}

if (carriers.length === 0) {
  faults.push(
    'No published package declares a `workspace:` dependency any more, so the rule above ' +
      'guards nothing. Delete this check rather than leave it standing.',
  )
}

if (faults.length > 0) {
  process.stderr.write(
    `The bootstrap publish is wrong:\n\n${faults.map((f) => `  - ${f}`).join('\n')}\n`,
  )
  process.exit(1)
}

process.stdout.write(
  `Verified ${script} publishes with pnpm, which ${carriers.length} published ` +
    `${carriers.length === 1 ? 'package needs' : 'packages need'} to have their ` +
    `\`workspace:\` ranges rewritten: ${carriers.join(', ')}\n`,
)
