import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readSdkVersion, repositoryRoot } from './lib.mjs'

// `changeset version` bumps @toolpath/api; the Python SDK ships under the same version.
// Only version lines change, so this needs neither Docker, uv nor the code generators.
const versionFiles = [
  {
    path: 'packages/sdk-python/pyproject.toml',
    line: /^version = ".*"$/m,
    replacement: (version) => `version = "${version}"`,
  },
  {
    // The example installs the SDK from its directory, and its lockfile records that version.
    path: 'examples/python/uv.lock',
    line: /^name = "toolpath"\nversion = ".*"$/m,
    replacement: (version) => `name = "toolpath"\nversion = "${version}"`,
  },
]

const syncVersion = async ({ path, line, replacement }, version) => {
  const filePath = join(repositoryRoot, path)
  const contents = await readFile(filePath, 'utf8')
  if (!line.test(contents)) {
    throw new Error(`${path} has no toolpath version line`)
  }
  await writeFile(filePath, contents.replace(line, replacement(version)), 'utf8')
}

const version = await readSdkVersion()
await Promise.all(versionFiles.map((file) => syncVersion(file, version)))

process.stdout.write(`Python SDK version is ${version}\n`)
