import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * Copies the assets into `dist/`, beside the web build.
 *
 * The web build's tsup configuration runs this when it succeeds, so a watch
 * rebuild, which cleans its output first, puts them back. The React Native
 * build has no copy of its own: it keeps its import of the model as written,
 * `../assets/banana.glb`, which from `dist/native/` is this one.
 */
const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))

await mkdir(path('../dist/assets/'), { recursive: true })
await cp(path('../src/assets/banana.glb'), path('../dist/assets/banana.glb'))
await cp(path('../src/toolbar.css'), path('../dist/toolbar.css'))
