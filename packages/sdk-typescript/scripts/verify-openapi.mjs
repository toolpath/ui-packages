import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const packageFile = (path) => new URL(`../${path}`, import.meta.url)

const [artifact, checksumFile, releaseFile, packageManifest] = await Promise.all([
  readFile(packageFile('openapi/openapi.json')),
  readFile(packageFile('openapi/openapi.sha256'), 'utf8'),
  readFile(packageFile('openapi/release.json'), 'utf8'),
  readFile(packageFile('package.json'), 'utf8'),
])
const document = JSON.parse(artifact.toString('utf8'))
const release = JSON.parse(releaseFile)
const typescriptPackage = JSON.parse(packageManifest)
const sha256 = createHash('sha256').update(artifact).digest('hex')
const recordedChecksum = checksumFile.trim().split(/\s+/)[0]
const operationIds = Object.values(document.paths ?? {})
  .flatMap((pathItem) => Object.values(pathItem))
  .flatMap((operation) => (operation.operationId ? [operation.operationId] : []))
  .sort()

if (recordedChecksum !== sha256 || release.sha256 !== sha256) {
  throw new Error('OpenAPI checksum does not match the retained document')
}
if (release.apiVersion !== document.info?.version || release.openApiVersion !== document.openapi) {
  throw new Error('OpenAPI release metadata does not match the retained document')
}
if (JSON.stringify(release.operationIds) !== JSON.stringify(operationIds)) {
  throw new Error('OpenAPI release operation IDs do not match the retained document')
}
if (
  typescriptPackage.toolpath?.openApiSha256 !== sha256 ||
  typescriptPackage.toolpath?.openApiVersion !== release.apiVersion
) {
  throw new Error('TypeScript package provenance does not match the OpenAPI release metadata')
}

process.stdout.write(
  `Verified Engine API ${release.apiVersion} OpenAPI snapshot (${operationIds.length} operations)\n`,
)
