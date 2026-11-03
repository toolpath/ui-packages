import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Packs the built package and checks the tarball holds what a Tailwind v4 consumer needs.
// Needs `pnpm build` first; turbo runs it before this package's `test`.
const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureRoot = await mkdtemp(join(tmpdir(), 'toolpath-ui-package-'))

try {
  const packed = execFileSync('npm', ['pack', '--json', '--pack-destination', fixtureRoot], {
    cwd: packageRoot,
    encoding: 'utf8',
  })
  const [{ filename }] = JSON.parse(packed)
  const archive = execFileSync('tar', ['-tzf', join(fixtureRoot, filename)], { encoding: 'utf8' })
  for (const entry of [
    'package/theme.css',
    'package/dist/index.js',
    'package/dist/index.d.ts',
    'package/src/index.ts',
  ]) {
    if (!archive.includes(entry)) {
      throw new Error(`Published UI package is missing ${entry}`)
    }
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true })
}

process.stdout.write('Verified the packed Tailwind v4 UI package\n')
