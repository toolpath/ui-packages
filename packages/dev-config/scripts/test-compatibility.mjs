// The explicit compatibility matrix: the second TypeScript line, npm workspaces,
// both Engine SDK channels, every React adapter and the native runner, each in
// disposable consumers installed from the packed tarball with pinned tools.
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { runCoreCompatibility } from './compatibility/core.mjs'
import { runReactCompatibility } from './compatibility/react.mjs'
import { createWorkRoot, packTarball } from './harness.mjs'

const keep = process.argv.includes('--keep')
const only = process.argv
  .find((argument) => argument.startsWith('--only='))
  ?.slice('--only='.length)
const work = createWorkRoot()
const tarball = packTarball(join(work, 'tarballs'))
const started = performance.now()
/** @type {Array<string>} */
const lines = []
/** @param {string} line */
const log = (line) => {
  lines.push(line)
  process.stdout.write(`  ${line}\n`)
}

try {
  if (only === undefined || only === 'core') {
    runCoreCompatibility({ tarball, workDir: join(work, 'core'), log })
  }
  if (only === undefined || only === 'react') {
    await runReactCompatibility({ tarball, workDir: join(work, 'react'), log })
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  )
  process.stderr.write(`Disposable consumers kept in ${work}\n`)
  process.exit(1)
}

if (!keep) {
  rmSync(work, { recursive: true, force: true })
}
process.stdout.write(
  `test:compatibility: ${String(lines.length)} combinations passed (${((performance.now() - started) / 1000).toFixed(1)}s)\n`,
)
