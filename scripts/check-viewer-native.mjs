/**
 * What the viewer's builds ship holds together: what types cannot say.
 *
 * Metro picks `dist/native/` through the `react-native` export condition, and
 * nothing in the web build, its tests or a browser ever loads it. So this
 * builds the viewer, every time, and checks the output: the entries and the
 * assets are there, each model the native build imports is where that import
 * points (the native build has no copy of its own), the React Native peer
 * admits only a Metro that reads the exports map, the Metro helper loads as
 * CommonJS, and the web build imports nothing only a phone has.
 * `tests/platform-boundary.test.ts` keeps the DOM out of what the native build
 * runs.
 */

import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { repositoryRoot, run } from './lib.mjs'

const viewer = join(repositoryRoot, 'packages/viewer')
const native = join(viewer, 'dist/native')

/** Under the package. The notices cover the font outlines `dist/native` bundles. */
const REQUIRED = [
  'dist/native/index.js',
  'dist/native/index.d.ts',
  'dist/native/engine/index.js',
  'dist/native/engine/index.d.ts',
  'dist/native/banana.js',
  'dist/native/banana.d.ts',
  'dist/index.js',
  'dist/banana.js',
  'dist/metro/index.cjs',
  'dist/metro/index.d.cts',
  'dist/assets/banana.glb',
  'dist/toolbar.css',
  'THIRD-PARTY-NOTICES',
]

/** An asset the native build imports, which Metro bundles from where the import points. */
const ASSET_SPECIFIER = /from\s*"(\.\.?\/[^"]*\.glb)"/g

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
  for (const match of source.matchAll(ASSET_SPECIFIER)) {
    if (existsSync(resolve(dirname(path), match[1]))) continue
    const line = source.slice(0, match.index).split('\n').length
    failures.push(`${relative(viewer, path)}:${line} imports ${match[1]}, which is missing`)
  }
}

// `./engine` reaches the native build only through the exports map, which
// Metro reads by default from React Native 0.79; on an older one the subpath
// does not resolve, so the peer range must not admit it.
const { peerDependencies } = JSON.parse(await readFile(join(viewer, 'package.json'), 'utf8'))
const reactNative = peerDependencies?.['react-native'] ?? ''
const floor = /^>=0\.(\d+)$/.exec(reactNative)
if (!floor || Number(floor[1]) < 79) {
  failures.push(`peer react-native "${reactNative}" admits a Metro that ignores the exports map`)
}

// `metro.config.js` is CommonJS, which `require`s the helper.
const metro = join(viewer, 'dist/metro/index.cjs')
if (
  existsSync(metro) &&
  typeof createRequire(import.meta.url)(metro).withToolpathViewer !== 'function'
) {
  failures.push('dist/metro/index.cjs does not export withToolpathViewer to require')
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
  `Verified the viewer's React Native build: ${files.length} scripts, its assets in place; and the web build: ${web.length} scripts, nothing native`,
)
