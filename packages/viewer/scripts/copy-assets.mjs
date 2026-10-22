import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * Copies one build's assets beside it: `web` or `native`.
 *
 * Each tsup configuration runs this for its own build when it succeeds, so a
 * watch rebuild, which cleans its output first, puts them back.
 */
const build = process.argv[2]
if (build !== 'web' && build !== 'native') {
  throw new Error('Usage: node scripts/copy-assets.mjs web|native')
}

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))
const out = build === 'web' ? '../dist/' : '../dist/native/'

// Both builds import the model relative to themselves, so each gets a copy.
await mkdir(path(`${out}assets/`), { recursive: true })
await cp(path('../src/assets/banana.glb'), path(`${out}assets/banana.glb`))
if (build === 'web') await cp(path('../src/toolbar.css'), path('../dist/toolbar.css'))
