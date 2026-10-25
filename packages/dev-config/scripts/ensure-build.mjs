// Builds only when `dist` is missing or older than its inputs, so a chain of
// package scripts (lint, check-types, test) builds once instead of every time.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildInputsHash } from './build-inputs.mjs'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const stamp = join(packageRoot, 'dist/.build-inputs')
const current =
  existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === buildInputsHash(packageRoot)

if (!current) {
  const built = spawnSync(process.execPath, [join(packageRoot, 'scripts/build.mjs')], {
    cwd: packageRoot,
    stdio: 'inherit',
  })
  if (built.status !== 0) {
    process.exit(built.status ?? 1)
  }
}
