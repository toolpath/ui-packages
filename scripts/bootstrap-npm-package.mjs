import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot, run } from './lib.mjs'

const registry = 'https://registry.npmjs.org'
const workflow = 'release.yml'
const packageName = process.argv[2]

const normalizeGithubRepository = (value) =>
  value
    .trim()
    .replace(/^git\+/, '')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/^http:\/\/github\.com\//, 'https://github.com/')
    .replace(/\.git$/, '')

if (!packageName || process.argv.length !== 3) {
  throw new Error(
    'Usage: pnpm bootstrap:npm-package <package-name>\nExample: pnpm bootstrap:npm-package @toolpath/tool-scraper',
  )
}

const packageDirectories = await readdir(join(repositoryRoot, 'packages'), {
  withFileTypes: true,
})
const packageDirectory = (
  await Promise.all(
    packageDirectories
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const directory = join(repositoryRoot, 'packages', entry.name)
        try {
          const packageJson = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
          return packageJson.name === packageName ? { directory, packageJson } : undefined
        } catch (error) {
          if (error.code === 'ENOENT') return undefined
          throw error
        }
      }),
  )
).find(Boolean)

if (!packageDirectory) {
  throw new Error(`No workspace package named ${packageName} was found.`)
}

const { directory, packageJson } = packageDirectory
if (packageJson.version === '0.0.0') {
  throw new Error(
    `${packageName} is still at 0.0.0. Run this from the Changesets release-metadata PR after it assigns the first release version.`,
  )
}

const origin = await run('git', ['remote', 'get-url', 'origin'], repositoryRoot, {
  capture: true,
  quiet: true,
})
const repository = normalizeGithubRepository(origin.stdout)
const repositorySlug = new URL(repository).pathname.slice(1)
const declaredRepository = packageJson.repository?.url
  ? normalizeGithubRepository(packageJson.repository.url)
  : undefined

if (declaredRepository !== `${repository}`) {
  throw new Error(
    `${packageName} declares ${packageJson.repository?.url ?? 'no repository URL'}, but origin is ${repository}. Update package.json before publishing.`,
  )
}

const npmView = async (specifier) => {
  try {
    return await run(
      'npm',
      ['view', specifier, 'version', '--registry', registry],
      repositoryRoot,
      {
        capture: true,
        quiet: true,
      },
    )
  } catch (error) {
    if (error.message.includes('E404')) return undefined
    throw error
  }
}

await run('npm', ['whoami', '--registry', registry], repositoryRoot)

const publishedVersion = await npmView(`${packageName}@${packageJson.version}`)
if (publishedVersion) {
  process.stdout.write(
    `${packageName}@${packageJson.version} is already published; skipping publish.\n`,
  )
} else {
  await run('pnpm', ['build'], directory)
  // pnpm, not npm. A workspace dependency is written `workspace:^` in the
  // manifest and has to be rewritten to a real range at pack time: pnpm does
  // that, npm publishes the protocol verbatim, and the result installs with
  // EUNSUPPORTEDPROTOCOL for everyone. `changeset publish` goes through pnpm
  // for the same reason, and this is the one publish in the repository that
  // does not — so it is the one that has to say so.
  //
  // Git checks are off because this runs on the Changesets release-metadata
  // branch by design, and pnpm otherwise refuses to publish from anything but
  // the default branch.
  await run('pnpm', ['publish', '--access', 'public', '--no-git-checks'], directory)
}

let trusts = []
try {
  const listed = await run('npm', ['trust', 'list', packageName, '--json'], repositoryRoot, {
    capture: true,
    quiet: true,
  })
  trusts = listed.stdout ? [JSON.parse(listed.stdout)].flat() : []
} catch (error) {
  if (!error.message.includes('E404')) throw error
}

const matchingTrust = trusts.find(
  (trust) =>
    trust.type === 'github' && trust.repository === repositorySlug && trust.file === workflow,
)

if (matchingTrust) {
  process.stdout.write(`${packageName} already trusts ${repository}/${workflow}.\n`)
} else if (trusts.length > 0) {
  throw new Error(
    `${packageName} already has a different trusted publisher. Run npm trust list ${packageName}, revoke that entry, then rerun this command.`,
  )
} else {
  await run(
    'npm',
    [
      'trust',
      'github',
      packageName,
      '--repo',
      repositorySlug,
      '--file',
      workflow,
      '--allow-publish',
      '--yes',
    ],
    repositoryRoot,
  )
}

process.stdout.write(
  `\nBootstrap complete. Merge the release-metadata PR; future CI releases will use trusted publishing.\n`,
)
