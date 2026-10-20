import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = new URL('../src/assets/banana.glb', import.meta.url)
const stylesheet = new URL('../src/toolbar.css', import.meta.url)
const stylesheetTarget = new URL('../dist/toolbar.css', import.meta.url)

// Both builds import the model relative to themselves, so each gets a copy.
for (const directory of ['../dist/assets/', '../dist/native/assets/']) {
  const assetDirectory = new URL(directory, import.meta.url)
  await mkdir(fileURLToPath(assetDirectory), { recursive: true })
  await cp(fileURLToPath(source), fileURLToPath(new URL('banana.glb', assetDirectory)))
}
await cp(fileURLToPath(stylesheet), fileURLToPath(stylesheetTarget))
