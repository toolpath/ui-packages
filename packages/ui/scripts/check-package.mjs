import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
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

  // React is a peer dependency: the bundle imports it and holds none of its source.
  const bundle = await readFile(join(packageRoot, 'dist/index.js'), 'utf8')
  if (!/from\s*["']react["']/.test(bundle)) {
    throw new Error('dist/index.js does not import react')
  }
  for (const marker of ['react.transitional.element', '__CLIENT_INTERNALS_DO_NOT_USE']) {
    if (bundle.includes(marker)) {
      throw new Error(`dist/index.js bundles React (found ${marker})`)
    }
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true })
}

process.stdout.write('Verified the packed Tailwind v4 UI package\n')
