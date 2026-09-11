import { appendFile, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot, run } from './lib.mjs'

const registry = 'https://registry.npmjs.org'
const packageDirectories = await readdir(join(repositoryRoot, 'packages'), {
  withFileTypes: true,
})

const npmPackages = (
  await Promise.all(
    packageDirectories
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          const packageJson = JSON.parse(
            await readFile(join(repositoryRoot, 'packages', entry.name, 'package.json'), 'utf8'),
          )
          // A private package never reaches npm, so it never needs a first publish
          // — and left in, one would hold back every release the workflow makes.
          if (packageJson.private) return undefined
          return packageJson.publishConfig?.registry === registry ? packageJson.name : undefined
        } catch (error) {
          if (error.code === 'ENOENT') return undefined
          throw error
        }
      }),
  )
).filter(Boolean)

const unpublishedPackages = []
for (const packageName of npmPackages) {
  try {
    await run('npm', ['view', packageName, 'version', '--registry', registry], repositoryRoot, {
      capture: true,
      quiet: true,
    })
  } catch (error) {
    if (error.message.includes('E404')) {
      unpublishedPackages.push(packageName)
      continue
    }
    throw error
  }
}

const requiresBootstrap = unpublishedPackages.length > 0
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `required=${requiresBootstrap}\npackages=${unpublishedPackages.join(' ')}\n`,
  )
}

if (requiresBootstrap) {
  process.stdout.write(
    `First npm publish required for: ${unpublishedPackages.join(', ')}. Auto-merge will be skipped.\n`,
  )
}
