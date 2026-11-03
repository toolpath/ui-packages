import { createHash } from 'node:crypto'
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const inputPaths = process.argv.slice(2).filter((argument) => argument !== '--')
if (inputPaths.length !== 1) {
  throw new Error('Usage: pnpm openapi:adopt -- /path/to/openapi.json')
}
const [inputPath] = inputPaths

// A relative path is the caller's: pnpm runs this from the package, but sets INIT_CWD to where
// it was invoked.
const sourcePath = resolve(process.env.INIT_CWD ?? process.cwd(), inputPath)
const openApiRoot = fileURLToPath(new URL('../openapi', import.meta.url))
const artifactPath = join(openApiRoot, 'openapi.json')
const checksumPath = join(openApiRoot, 'openapi.sha256')
const releasePath = join(openApiRoot, 'release.json')
const [artifact, existingRelease] = await Promise.all([
  readFile(sourcePath),
  readFile(releasePath, 'utf8').then(JSON.parse),
])
const document = JSON.parse(artifact.toString('utf8'))

if (
  document.openapi !== '3.1.0' ||
  typeof document.info?.version !== 'string' ||
  !document.paths ||
  typeof document.paths !== 'object'
) {
  throw new Error(
    'The supplied artifact must be an OpenAPI 3.1 document with an API version and paths',
  )
}

const operationIds = Object.values(document.paths)
  .flatMap((pathItem) => Object.values(pathItem))
  .flatMap((operation) => (operation?.operationId ? [operation.operationId] : []))
  .sort()
const sha256 = createHash('sha256').update(artifact).digest('hex')
const release = {
  apiVersion: document.info.version,
  openApiVersion: document.openapi,
  sha256,
  generators: existingRelease.generators,
  operationIds,
}

await Promise.all([
  copyFile(sourcePath, artifactPath),
  writeFile(checksumPath, `${sha256}  ${basename(artifactPath)}\n`, 'utf8'),
  writeFile(releasePath, `${JSON.stringify(release, null, 2)}\n`, 'utf8'),
])

process.stdout.write(
  `Adopted Engine API ${release.apiVersion} OpenAPI snapshot (${operationIds.length} operations)\n`,
)
