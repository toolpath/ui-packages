import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = new URL('../src/assets/banana.glb', import.meta.url)
const assetDirectory = new URL('../dist/assets/', import.meta.url)
const target = new URL('banana.glb', assetDirectory)
const stylesheet = new URL('../src/toolbar.css', import.meta.url)
const stylesheetTarget = new URL('../dist/toolbar.css', import.meta.url)

await mkdir(fileURLToPath(assetDirectory), { recursive: true })
await cp(fileURLToPath(source), fileURLToPath(target))
await cp(fileURLToPath(stylesheet), fileURLToPath(stylesheetTarget))
