import { readFile, writeFile } from 'node:fs/promises'

// `changeset version` bumps @toolpath/api; the Python SDK ships under the same version.
// Only the version line changes, so this needs neither Docker, uv nor the code generators.
const packageFile = (path) => new URL(`../${path}`, import.meta.url)
const versionLine = /^version = ".*"$/m

const { version } = JSON.parse(
  await readFile(packageFile('../sdk-typescript/package.json'), 'utf8'),
)
if (!version) {
  throw new Error('sdk-typescript/package.json does not declare a version')
}
const pyproject = await readFile(packageFile('pyproject.toml'), 'utf8')
if (!versionLine.test(pyproject)) {
  throw new Error('pyproject.toml has no version line')
}
await writeFile(packageFile('pyproject.toml'), pyproject.replace(versionLine, `version = "${version}"`))

process.stdout.write(`Python SDK version is ${version}\n`)
