import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertInsideRepository, readSdkVersion, repositoryRoot, run } from './lib.mjs'

const openApiPath = join(repositoryRoot, 'openapi/openapi.json')
const typescriptRoot = join(repositoryRoot, 'packages/sdk-typescript')
const typescriptGeneratedRoot = join(typescriptRoot, 'src/generated')
const pythonRoot = join(repositoryRoot, 'packages/sdk-python')
const pythonPackageRoot = join(pythonRoot, 'toolpath')
const [openApiChecksum, releaseMetadata] = await Promise.all([
  readFile(join(repositoryRoot, 'openapi/openapi.sha256'), 'utf8'),
  readFile(join(repositoryRoot, 'openapi/release.json'), 'utf8').then(JSON.parse),
])
const openApiSha256 = openApiChecksum.trim().split(/\s+/)[0]
const pythonVersion = await readSdkVersion()

const typescriptStagingRoot = await mkdtemp(join(tmpdir(), 'toolpath-typescript-codegen-'))
const pythonStagingRoot = await mkdtemp(join(tmpdir(), 'toolpath-python-codegen-'))
const pythonStagingOutput = join(pythonStagingRoot, 'client')

try {
  const user = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`
  await run('docker', [
    'run',
    '--rm',
    '--user',
    user,
    '--volume',
    `${repositoryRoot}:/local:ro`,
    '--volume',
    `${typescriptStagingRoot}:/out`,
    'openapitools/openapi-generator-cli:v7.24.0',
    'generate',
    '--input-spec',
    '/local/openapi/openapi.json',
    '--generator-name',
    'typescript-fetch',
    '--output',
    '/out',
    '--config',
    '/local/codegen/typescript-fetch.yaml',
  ])
  await rm(assertInsideRepository(typescriptGeneratedRoot), { recursive: true, force: true })
  await mkdir(assertInsideRepository(typescriptGeneratedRoot), { recursive: true })
  await Promise.all([
    cp(join(typescriptStagingRoot, 'apis'), join(typescriptGeneratedRoot, 'apis'), {
      recursive: true,
    }),
    cp(join(typescriptStagingRoot, 'models'), join(typescriptGeneratedRoot, 'models'), {
      recursive: true,
    }),
    cp(join(typescriptStagingRoot, 'index.ts'), join(typescriptGeneratedRoot, 'index.ts')),
    cp(join(typescriptStagingRoot, 'runtime.ts'), join(typescriptGeneratedRoot, 'runtime.ts')),
  ])
  await run('pnpm', ['exec', 'prettier', '--write', typescriptGeneratedRoot])

  await run('uvx', [
    '--from',
    'openapi-python-client==0.29.0',
    'openapi-python-client',
    'generate',
    '--path',
    openApiPath,
    '--config',
    join(repositoryRoot, 'codegen/python.yaml'),
    '--meta',
    'uv',
    '--fail-on-warning',
    '--overwrite',
    '--output-path',
    pythonStagingOutput,
  ])

  await Promise.all([
    rm(assertInsideRepository(join(pythonPackageRoot, 'generated')), {
      recursive: true,
      force: true,
    }),
    rm(assertInsideRepository(join(pythonPackageRoot, 'api')), { recursive: true, force: true }),
    rm(assertInsideRepository(join(pythonPackageRoot, 'models')), { recursive: true, force: true }),
    rm(assertInsideRepository(join(pythonPackageRoot, 'client.py')), { force: true }),
    rm(assertInsideRepository(join(pythonPackageRoot, 'errors.py')), { force: true }),
    rm(assertInsideRepository(join(pythonPackageRoot, 'types.py')), { force: true }),
  ])
  await cp(
    join(pythonStagingOutput, 'toolpath'),
    assertInsideRepository(join(pythonPackageRoot, 'generated')),
    { recursive: true },
  )
} finally {
  await Promise.all([
    rm(typescriptStagingRoot, { recursive: true, force: true }),
    rm(pythonStagingRoot, { recursive: true, force: true }),
  ])
}

const typescriptPackagePath = join(typescriptRoot, 'package.json')
const typescriptPackage = JSON.parse(await readFile(typescriptPackagePath, 'utf8'))
const packageMetadata = (
  await readFile(join(repositoryRoot, 'codegen/python-pyproject.toml'), 'utf8')
)
  .replace('{{SDK_VERSION}}', pythonVersion)
  .replace('{{OPENAPI_SHA256}}', openApiSha256)
  .replace('{{OPENAPI_VERSION}}', releaseMetadata.apiVersion)
typescriptPackage.toolpath = {
  openApiSha256,
  openApiVersion: releaseMetadata.apiVersion,
}
await Promise.all([
  writeFile(join(pythonRoot, 'pyproject.toml'), packageMetadata, 'utf8'),
  writeFile(typescriptPackagePath, `${JSON.stringify(typescriptPackage, null, 2)}\n`, 'utf8'),
])

process.stdout.write('Generated TypeScript and Python SDK source\n')
