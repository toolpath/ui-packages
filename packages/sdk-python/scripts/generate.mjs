import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Regenerates toolpath/generated and pyproject.toml from @toolpath/api's OpenAPI snapshot, under
// that package's version.
const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const typescriptRoot = join(packageRoot, '../sdk-typescript')
const pythonPackageRoot = join(packageRoot, 'toolpath')
const [openApiChecksum, releaseMetadata, typescriptPackage] = await Promise.all([
  readFile(join(typescriptRoot, 'openapi/openapi.sha256'), 'utf8'),
  readFile(join(typescriptRoot, 'openapi/release.json'), 'utf8').then(JSON.parse),
  readFile(join(typescriptRoot, 'package.json'), 'utf8').then(JSON.parse),
])

const stagingRoot = await mkdtemp(join(tmpdir(), 'toolpath-python-codegen-'))
const stagingOutput = join(stagingRoot, 'client')
try {
  const args = [
    '--from',
    'openapi-python-client==0.29.0',
    'openapi-python-client',
    'generate',
    '--path',
    join(typescriptRoot, 'openapi/openapi.json'),
    '--config',
    join(packageRoot, 'codegen/python.yaml'),
    '--meta',
    'uv',
    '--fail-on-warning',
    '--overwrite',
    '--output-path',
    stagingOutput,
  ]
  process.stdout.write(`\n> uvx ${args.join(' ')}\n`)
  execFileSync('uvx', args, { cwd: packageRoot, stdio: 'inherit' })

  await Promise.all(
    ['generated', 'api', 'models', 'client.py', 'errors.py', 'types.py'].map((entry) =>
      rm(join(pythonPackageRoot, entry), { recursive: true, force: true }),
    ),
  )
  await cp(join(stagingOutput, 'toolpath'), join(pythonPackageRoot, 'generated'), {
    recursive: true,
  })
} finally {
  await rm(stagingRoot, { recursive: true, force: true })
}

const packageMetadata = (await readFile(join(packageRoot, 'codegen/python-pyproject.toml'), 'utf8'))
  .replace('{{SDK_VERSION}}', typescriptPackage.version)
  .replace('{{OPENAPI_SHA256}}', openApiChecksum.trim().split(/\s+/)[0])
  .replace('{{OPENAPI_VERSION}}', releaseMetadata.apiVersion)
await writeFile(join(packageRoot, 'pyproject.toml'), packageMetadata, 'utf8')

process.stdout.write('Generated Python SDK source\n')
