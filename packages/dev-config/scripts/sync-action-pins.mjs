// Rewrites every third-party reference in the shared CI files from the one
// registry, src/ci/pins.json: each `uses: owner/repo@<sha> # <version>` and
// the actionlint download the selftest verifies. `--check` changes nothing and
// fails when a file disagrees with the registry.
//
// To move a pin: resolve the release tag to its commit SHA (`gh api
// repos/<owner>/<repo>/git/ref/tags/<tag>`, dereferencing an annotated tag),
// update pins.json, run this script, and let tests/ci prove the result.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url))

export const CI_FILES = [
  '.github/workflows/dev-config-quality.yml',
  '.github/workflows/dev-config-selftest.yml',
  '.github/actions/dev-config-setup/action.yml',
  '.github/actions/dev-config-check/action.yml',
  '.github/actions/dev-config-result/action.yml',
]

/**
 * @typedef {{
 *   actions: Record<string, { version: string, sha: string }>,
 *   tools: { actionlint: { version: string, url: string, sha256: string } },
 * }} Pins
 */

/** @returns {Pins} */
const readPins = () => {
  /** @type {unknown} */
  const value = JSON.parse(readFileSync(new URL('../src/ci/pins.json', import.meta.url), 'utf8'))
  return /** @type {Pins} */ (value)
}

/**
 * The file's text with every pinned reference set from the registry.
 * @param {string} text
 * @param {Pins} pins
 * @returns {{ text: string, unknown: Array<string> }}
 */
export const applyPins = (text, pins) => {
  /** @type {Array<string>} */
  const unknown = []
  const rewritten = text
    .replace(
      /uses: ([\w.-]+\/[\w.-]+)@[^\s#]+(?: # \S+)?/g,
      (match, /** @type {string} */ action) => {
        const pin = pins.actions[action]
        if (!pin) {
          unknown.push(action)
          return match
        }
        return `uses: ${action}@${pin.sha} # ${pin.version}`
      },
    )
    .replace(
      /https:\/\/github\.com\/rhysd\/actionlint\/releases\/download\/\S+/g,
      pins.tools.actionlint.url,
    )
    .replace(/(ACTIONLINT_SHA256: )[0-9a-f]{64}/g, `$1${pins.tools.actionlint.sha256}`)
  return { text: rewritten, unknown }
}

const main = () => {
  const check = process.argv.includes('--check')
  const pins = readPins()
  const stale = []
  for (const file of CI_FILES) {
    const path = join(repositoryRoot, file)
    const before = readFileSync(path, 'utf8')
    const { text, unknown } = applyPins(before, pins)
    if (unknown.length > 0) {
      throw new Error(`${file} uses ${unknown.join(', ')}, which src/ci/pins.json does not pin`)
    }
    if (text !== before) {
      stale.push(file)
      if (!check) {
        writeFileSync(path, text)
      }
    }
  }
  if (check && stale.length > 0) {
    process.stderr.write(
      `These files disagree with src/ci/pins.json:\n${stale.map((file) => `  - ${file}`).join('\n')}\n`,
    )
    process.exitCode = 1
    return
  }
  process.stdout.write(
    stale.length === 0 ? 'Every pin matches src/ci/pins.json.\n' : `Updated ${stale.join(', ')}.\n`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
