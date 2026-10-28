import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * Copies the assets into `dist/`, beside the web build.
 *
 * The web build's tsup configuration runs this when it succeeds. The React Native
 * build has no copy of its own: it imports this one, `../assets/banana.glb` from
 * `dist/native/`.
 */
const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))

await mkdir(path('../dist/assets/'), { recursive: true })
await cp(path('../src/assets/banana.glb'), path('../dist/assets/banana.glb'))
await cp(path('../src/toolbar.css'), path('../dist/toolbar.css'))
