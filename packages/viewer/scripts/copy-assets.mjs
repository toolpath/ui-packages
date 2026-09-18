import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = new URL('../src/assets/banana.glb', import.meta.url)
const assetDirectory = new URL('../dist/assets/', import.meta.url)
const target = new URL('banana.glb', assetDirectory)

await mkdir(fileURLToPath(assetDirectory), { recursive: true })
await cp(fileURLToPath(source), fileURLToPath(target))
