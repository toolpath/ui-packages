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
 * It builds the viewer first, every time, so it never checks a stale build or
 * skips for want of one. The web build's assets are checked too: both builds
 * copy their own, and a rebuild that cleaned them away would ship without.
 */

import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { repositoryRoot, run } from './lib.mjs'

const viewer = join(repositoryRoot, 'packages/viewer')
const native = join(viewer, 'dist/native')

/** Under the package. The notices cover the font outlines `dist/native` bundles. */
const REQUIRED = [
  'dist/native/index.js',
  'dist/native/engine/index.js',
  'dist/native/assets/banana.glb',
  'dist/index.js',
  'dist/assets/banana.glb',
  'dist/toolbar.css',
  'THIRD-PARTY-NOTICES',
]

/** What only a browser has: the DOM, `import.meta` (Metro has none), and the web halves of the renderers. */
const FORBIDDEN = ['document.', 'window.addEventListener', 'import.meta', 'react-dom', 'drei/web']

/** A DOM element made by the JSX runtime: `jsx("div", …)` and the like. */
const DOM_JSX =
  /\bjsx\w*\(\s*"(a|button|canvas|div|g|img|input|label|li|p|path|section|span|svg|ul)"/

/** What only a phone has, which the web build must never import. */
const NATIVE_SPECIFIER =
  /from\s*"(react-native|expo-[^"]*|three-mesh-bvh[^"]*|@react-three\/fiber\/native)"/

await run('pnpm', ['--filter', '@toolpath/viewer', 'build'])

const failures = []

for (const file of REQUIRED) {
  if (!existsSync(join(viewer, file))) failures.push(`${file} is missing`)
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

for (const path of files) {
  const source = await readFile(path, 'utf8')
  const match = DOM_JSX.exec(source)
  if (!match) continue
  const line = source.slice(0, match.index).split('\n').length
  failures.push(`${relative(viewer, path)}:${line} makes a <${match[1]}>`)
}

// The web build: everything in `dist/` but the native build.
const web = (await readdir(join(viewer, 'dist'), { recursive: true }))
  .filter((file) => file.endsWith('.js') && !file.startsWith('native'))
  .map((file) => join(viewer, 'dist', file))
for (const path of web) {
  const source = await readFile(path, 'utf8')
  const match = NATIVE_SPECIFIER.exec(source)
  if (!match) continue
  const line = source.slice(0, match.index).split('\n').length
  failures.push(`${relative(viewer, path)}:${line} imports ${match[1]}`)
}

if (failures.length > 0) {
  console.error(`The viewer's React Native build is not fit to ship:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}

console.log(
  `Verified the viewer's React Native build: ${files.length} scripts, no DOM; and the web build: ${web.length} scripts, nothing native`,
)
