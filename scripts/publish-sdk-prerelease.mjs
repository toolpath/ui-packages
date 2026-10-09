/**
 * Publishes `@toolpath/api` under npm's `staging` dist-tag from the contract Engine
 * staging serves, so an internal application can pin a contract that is on staging
 * but not yet in production. `latest` is never touched: the stable release still
 * arrives through the production promotion and Changesets.
 *
 * The contract is fetched from staging rather than taken from the dispatch that
 * asks for the publish — the URL is fixed here, the payload only says what the
 * sender expected to find there. Nothing this writes is committed: the checkout
 * is a throwaway, and the version is a snapshot
 * (`<next stable>-staging.<UTC datetime>.g<services sha>`) that cannot collide
 * with a stable one or sort above the next.
 *
 * Idempotent by construction: the same contract from the same `ui-packages`
 * commit is already on the tag, so a repeated dispatch publishes nothing.
 */

import { createHash } from 'node:crypto'
import { appendFile, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { repositoryRoot, run } from './lib.mjs'

const contractUrl = 'https://api.staging.toolpath.com/v1/openapi.json'
const packageName = '@toolpath/api'
const manifestPath = join(repositoryRoot, 'packages/sdk-typescript/package.json')
const releasePath = join(repositoryRoot, 'openapi/release.json')
const changesetRoot = join(repositoryRoot, '.changeset')

const servicesSha = process.env.SERVICES_SHA ?? ''
const uiPackagesSha = process.env.GITHUB_SHA ?? ''
const expectedApiVersion = process.env.EXPECTED_API_VERSION || undefined
const expectedSha256 = process.env.EXPECTED_SHA256 || undefined
const servicesRunUrl = process.env.SERVICES_RUN_URL || undefined
const dryRun = process.env.DRY_RUN === 'true'

if (!/^[0-9a-f]{7,40}$/.test(servicesSha)) {
  throw new Error('SERVICES_SHA must be the services commit the contract came from (7–40 hex)')
}
if (!/^[0-9a-f]{40}$/.test(uiPackagesSha)) {
  throw new Error('GITHUB_SHA must be the full ui-packages commit being published')
}

const log = (message) => process.stdout.write(`${message}\n`)

/** Shows up on the run's summary page; the log is where the detail is. */
const summarize = async (markdown) => {
  log(markdown)
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
  }
}

const parseVersion = (version, label) => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version ?? '')
  if (!match) {
    throw new Error(
      `${label} must be a stable semantic version, received ${JSON.stringify(version)}`,
    )
  }
  return {
    value: version,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

const compareVersions = (left, right) => {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key]
  }
  return 0
}

/** The Changeset bump a contract move earns; the same rule the production promotion applies. */
const releaseKind = (previous, current) => {
  if (compareVersions(current, previous) <= 0) {
    throw new Error(
      `Engine API OpenAPI contract changed, but its declared version did not. ` +
        `The SDK records Engine API ${previous.value}, and staging serves ${current.value}. ` +
        `Bump ENGINE_API_VERSION in services to a higher stable semantic version.`,
    )
  }
  if (current.major !== previous.major) return 'major'
  if (current.minor !== previous.minor) return 'minor'
  return 'patch'
}

/** Staging is behind a load balancer that occasionally drops a connection; a miss is not an answer. */
const fetchContract = async () => {
  let failure
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(contractUrl)
      if (!response.ok) throw new Error(`${contractUrl} answered ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      failure = error
      log(`Fetch attempt ${attempt} failed: ${error.message}`)
      await new Promise((resolveWait) => setTimeout(resolveWait, 1000 * 2 ** attempt))
    }
  }
  throw failure
}

/**
 * Whether a Changeset on this commit names the SDK. Read from the files rather than
 * `changeset status`, which diffs against a `main` ref the runner's checkout may not have.
 */
const sdkChangesetPending = async () => {
  for (const entry of await readdir(changesetRoot)) {
    if (!entry.endsWith('.md') || entry === 'README.md') continue
    const [, frontmatter = ''] = (await readFile(join(changesetRoot, entry), 'utf8')).split('---')
    if (/^['"]?@toolpath\/api['"]?\s*:\s*(major|minor|patch)\s*$/m.test(frontmatter)) return true
  }
  return false
}

/** `npm view` prints nothing, and exits 0, for a tag or field that does not exist. */
const npmView = async (spec, field) => {
  const { stdout } = await run('npm', ['view', spec, field, '--json'], repositoryRoot, {
    capture: true,
    quiet: true,
  })
  return stdout ? JSON.parse(stdout) : undefined
}

log(`Fetching ${contractUrl}`)
const artifact = await fetchContract()
const workRoot = await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'engine-api-staging-'))
const contractPath = join(workRoot, 'openapi.json')
await writeFile(contractPath, artifact)
const sha256 = createHash('sha256').update(artifact).digest('hex')
const apiVersion = parseVersion(
  JSON.parse(artifact.toString('utf8')).info?.version,
  'The Engine API version staging serves',
)
log(`Staging serves Engine API ${apiVersion.value} (sha256 ${sha256})`)

// A later services push already replaced what this dispatch described; its own
// dispatch will publish it, and publishing it here would race that run.
if (expectedSha256 && expectedSha256 !== sha256) {
  await summarize(
    `Staging moved on: the dispatch expected contract ${expectedSha256}, staging serves ` +
      `${sha256}. Nothing published; the newer dispatch publishes it.`,
  )
  process.exit(0)
}
if (expectedApiVersion && expectedApiVersion !== apiVersion.value) {
  throw new Error(
    `The dispatch expected Engine API ${expectedApiVersion} but staging serves ${apiVersion.value}`,
  )
}

const stagingVersion = await npmView(packageName, 'dist-tags.staging')
if (stagingVersion) {
  const published = (await npmView(`${packageName}@${stagingVersion}`, 'toolpath')) ?? {}
  if (published.openApiSha256 === sha256 && published.uiPackagesSha === uiPackagesSha) {
    await summarize(
      `Already published: ${packageName}@${stagingVersion} carries this contract from this commit.`,
    )
    process.exit(0)
  }
  // The tag only ever moves forward through Engine API versions; a lower one
  // means staging was rolled back, which a consumer should not silently follow.
  const publishedVersion = parseVersion(published.openApiVersion, 'The published openApiVersion')
  if (compareVersions(apiVersion, publishedVersion) < 0) {
    throw new Error(
      `Staging serves Engine API ${apiVersion.value}, older than the ${publishedVersion.value} ` +
        `already on ${packageName}@staging`,
    )
  }
}

const release = JSON.parse(await readFile(releasePath, 'utf8'))
const contractChanged = release.sha256 !== sha256
if (contractChanged) {
  const bump = releaseKind(parseVersion(release.apiVersion, 'The recorded apiVersion'), apiVersion)
  await writeFile(
    join(changesetRoot, `staging-engine-api-${apiVersion.value}.md`),
    `---\n'${packageName}': ${bump}\n---\n\nRegenerate the TypeScript SDK for Engine API ${apiVersion.value}.\n`,
  )
  log(`Wrote a ${bump} Changeset for Engine API ${release.apiVersion} -> ${apiVersion.value}`)
} else if (!(await sdkChangesetPending())) {
  // With nothing to release, the snapshot would leave the version alone and the
  // publish below would be refused as a duplicate.
  await summarize(
    `Nothing to publish: the SDK already records this contract and no Changeset names ${packageName}.`,
  )
  process.exit(0)
}

await run('pnpm', ['openapi:adopt', '--', contractPath])
await run('pnpm', ['generate'])
await run('pnpm', ['exec', 'changeset', 'version', '--snapshot', 'staging'])

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (!/^\d+\.\d+\.\d+-staging\.\d{14}$/.test(manifest.version)) {
  throw new Error(
    `changeset version --snapshot produced ${manifest.version}, not a staging version`,
  )
}
manifest.version = `${manifest.version}.g${servicesSha.slice(0, 7)}`
manifest.toolpath = {
  ...manifest.toolpath,
  channel: 'staging',
  servicesSha,
  uiPackagesSha,
  ...(servicesRunUrl ? { servicesRunUrl } : {}),
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
log(`Versioned ${packageName}@${manifest.version}`)

await run('pnpm', ['release:typescript-sdk:check'])
await run('pnpm', ['--filter', packageName, 'check-types'])

const latestBefore = await npmView(packageName, 'dist-tags.latest')
await run('pnpm', [
  '--filter',
  packageName,
  'publish',
  '--tag',
  'staging',
  '--access',
  'public',
  '--no-git-checks',
  ...(dryRun ? ['--dry-run'] : []),
])
const latestAfter = await npmView(packageName, 'dist-tags.latest')
if (latestAfter !== latestBefore) {
  throw new Error(
    `latest moved from ${latestBefore} to ${latestAfter} during a staging publish; restore it ` +
      `with: npm dist-tag add ${packageName}@${latestBefore} latest`,
  )
}

await summarize(
  [
    `${dryRun ? 'Dry run of' : 'Published'} \`${packageName}@${manifest.version}\` (tag \`staging\`)`,
    '',
    `- Engine API ${apiVersion.value}, contract sha256 \`${sha256}\``,
    `- services \`${servicesSha}\`${servicesRunUrl ? ` (${servicesRunUrl})` : ''}, ui-packages \`${uiPackagesSha}\``,
    `- \`latest\` still ${latestAfter}`,
    '',
    '```sh',
    `npm view ${packageName} dist-tags`,
    `npm view ${packageName}@staging toolpath`,
    '```',
  ].join('\n'),
)
