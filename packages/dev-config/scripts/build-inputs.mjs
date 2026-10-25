import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Everything `scripts/build.mjs` reads. A change to any of them makes `dist` stale. */
const INPUTS = [
  'src',
  'assets',
  'contracts',
  'package.json',
  'tsconfig.json',
  'tsconfig.build.json',
  'scripts/build.mjs',
]

/** @param {string} root @param {string} path @param {Array<string>} found */
const collect = (root, path, found) => {
  const absolute = join(root, path)
  if (!existsSync(absolute)) {
    return
  }
  if (statSync(absolute).isDirectory()) {
    for (const entry of readdirSync(absolute).sort()) {
      collect(root, `${path}/${entry}`, found)
    }
  } else {
    found.push(path)
  }
}

/**
 * A digest of the build's inputs, recorded in `dist/.build-inputs`.
 * @param {string} packageRoot
 * @returns {string}
 */
export const buildInputsHash = (packageRoot) => {
  /** @type {Array<string>} */
  const files = []
  for (const input of INPUTS) {
    collect(packageRoot, input, files)
  }
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(`${file}\0`)
    hash.update(readFileSync(join(packageRoot, file)))
    hash.update('\0')
  }
  return hash.digest('hex')
}
