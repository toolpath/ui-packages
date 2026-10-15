import { access, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { assertInsideRepository, readSdkVersion, repositoryRoot, run } from './lib.mjs'

const artifactsRoot = assertInsideRepository(join(repositoryRoot, 'artifacts'))
const packageRoot = join(repositoryRoot, 'packages/sdk-python')
const version = await readSdkVersion()
const packageFile = join(artifactsRoot, `toolpath-${version}-py3-none-any.whl`)

await Promise.all([mkdir(artifactsRoot, { recursive: true }), rm(packageFile, { force: true })])

await run('uv', [
  'build',
  '--wheel',
  '--out-dir',
  artifactsRoot,
  '--no-create-gitignore',
  packageRoot,
])
await access(packageFile)

process.stdout.write(`Packaged Python SDK in ${artifactsRoot}\n`)
