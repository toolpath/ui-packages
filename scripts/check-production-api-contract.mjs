import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { repositoryRoot } from './lib.mjs'

const productionOpenApiUrl = 'https://api.toolpath.com/v1/openapi.json'
const sdkContractPaths = [
  'packages/sdk-typescript/src/',
  'openapi/',
  'codegen/typescript-fetch.yaml',
  'scripts/generate-sdks.mjs',
]

export const versionOf = (document, source) => {
  const version = document?.info?.version
  if (typeof version !== 'string' || version === '') {
    throw new Error(`${source} does not declare an OpenAPI info.version.`)
  }
  return version
}

export const assertProductionContractVersion = (candidate, production) => {
  const candidateVersion = versionOf(candidate, 'The candidate SDK OpenAPI document')
  const productionVersion = versionOf(production, 'The production OpenAPI document')
  if (candidateVersion !== productionVersion) {
    throw new Error(
      `The candidate SDK targets Engine API ${candidateVersion}, but production serves ` +
        `${productionVersion}. Deploy the Engine API before merging this SDK update.`,
    )
  }
  return candidateVersion
}

export const changesSdkContract = (changedFiles) =>
  changedFiles.some((file) =>
    sdkContractPaths.some((path) => file === path || file.startsWith(path)),
  )

const changedFilesSince = (baseRef) =>
  execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)

export const verifyProductionContract = async (baseRef, request = fetch) => {
  if (!baseRef) {
    throw new Error('Pass the base ref, for example: origin/main')
  }
  if (!changesSdkContract(changedFilesSince(baseRef))) {
    process.stdout.write('The pull request does not change the TypeScript SDK contract.\n')
    return
  }

  const [candidateFile, response] = await Promise.all([
    readFile(join(repositoryRoot, 'openapi/openapi.json'), 'utf8'),
    request(productionOpenApiUrl),
  ])
  if (!response.ok) {
    throw new Error(`Could not read the production OpenAPI document: HTTP ${response.status}.`)
  }

  const candidate = JSON.parse(candidateFile)
  const production = await response.json()
  const version = assertProductionContractVersion(candidate, production)
  process.stdout.write(`Candidate TypeScript SDK matches production Engine API ${version}.\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await verifyProductionContract(process.argv[2])
}
