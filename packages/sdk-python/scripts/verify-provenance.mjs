import { readFile } from 'node:fs/promises'

// The Python SDK is generated from @toolpath/api's OpenAPI snapshot, and pyproject.toml records
// which one. That package's `openapi:verify` checks the snapshot itself.
const packageFile = (path) => new URL(`../${path}`, import.meta.url)

const [releaseFile, pyproject] = await Promise.all([
  readFile(packageFile('../sdk-typescript/openapi/release.json'), 'utf8'),
  readFile(packageFile('pyproject.toml'), 'utf8'),
])
const release = JSON.parse(releaseFile)

for (const value of [release.sha256, release.apiVersion]) {
  if (!pyproject.includes(`"${value}"`)) {
    throw new Error('Python package provenance does not match the OpenAPI release metadata')
  }
}

process.stdout.write(`Verified the Python SDK records Engine API ${release.apiVersion}\n`)
