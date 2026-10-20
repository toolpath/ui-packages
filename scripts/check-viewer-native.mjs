/**
 * The React Native build of `@toolpath/viewer` is there, and holds nothing a
 * phone cannot run.
 *
 * Metro picks `dist/native/` through the `react-native` export condition, and
 * nothing in the web build, its tests or a browser ever loads it — so a
 * missing entry or a `document` that crept in through a new import would ship
 * unnoticed until an app crashed on start. `platform-boundary.test.ts` holds
 * the line in the source; this checks what the build actually emitted, the
 * swaps included.
 *
 * It builds the viewer first when there is no native build, so the check is
 * never skipped for want of one.
 */

import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { repositoryRoot, run } from './lib.mjs'

const viewer = join(repositoryRoot, 'packages/viewer')
const native = join(viewer, 'dist/native')

const REQUIRED = ['index.js', 'engine/index.js', 'assets/banana.glb']

/** What only a browser has: the DOM, `import.meta` (Metro has none), and the web halves of the renderers. */
const FORBIDDEN = ['document.', 'window.addEventListener', 'import.meta', 'react-dom', 'drei/web']

if (!existsSync(native)) {
  await run('pnpm', ['--filter', '@toolpath/viewer', 'build'])
}

const failures = []

for (const file of REQUIRED) {
  if (!existsSync(join(native, file))) failures.push(`dist/native/${file} is missing`)
}

const files = existsSync(native)
  ? (await readdir(native, { recursive: true }))
      .filter((file) => file.endsWith('.js'))
      .map((file) => join(native, file))
  : []
for (const path of files) {
  const source = await readFile(path, 'utf8')
  for (const needle of FORBIDDEN) {
    const at = source.indexOf(needle)
    if (at === -1) continue
    const line = source.slice(0, at).split('\n').length
    failures.push(`${relative(viewer, path)}:${line} contains ${needle}`)
  }
}

if (failures.length > 0) {
  console.error(`The viewer's React Native build is not fit to ship:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}

console.log(`Verified the viewer's React Native build: ${files.length} scripts, no DOM`)
