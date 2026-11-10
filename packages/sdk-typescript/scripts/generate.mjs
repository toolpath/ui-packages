import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Regenerates src/generated from openapi/openapi.json and records the contract it came from in
// package.json. The Python SDK generates from the same snapshot (sdk-python's `generate`).
const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const generatedRoot = join(packageRoot, 'src/generated')
const packagePath = join(packageRoot, 'package.json')
const [openApiChecksum, releaseMetadata] = await Promise.all([
  readFile(join(packageRoot, 'openapi/openapi.sha256'), 'utf8'),
  readFile(join(packageRoot, 'openapi/release.json'), 'utf8').then(JSON.parse),
])

const run = (command, args) => {
  process.stdout.write(`\n> ${command} ${args.join(' ')}\n`)
  execFileSync(command, args, { cwd: packageRoot, stdio: 'inherit' })
}

const stagingRoot = await mkdtemp(join(tmpdir(), 'toolpath-typescript-codegen-'))
try {
  const user = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`
  run('docker', [
    'run',
    '--rm',
    '--user',
    user,
    '--volume',
    `${packageRoot}:/local:ro`,
    '--volume',
    `${stagingRoot}:/out`,
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
    // Overrides only the file header, which otherwise carries the API version and description
    // and so rewrites every generated file on each release. Other templates are the generator's.
    '--template-dir',
    '/local/codegen/templates',
  ])
  await rm(generatedRoot, { recursive: true, force: true })
  await mkdir(generatedRoot, { recursive: true })
  await Promise.all(
    ['apis', 'models', 'index.ts', 'runtime.ts'].map((entry) =>
      cp(join(stagingRoot, entry), join(generatedRoot, entry), { recursive: true }),
    ),
  )
  run('pnpm', ['exec', 'prettier', '--write', generatedRoot])
} finally {
  await rm(stagingRoot, { recursive: true, force: true })
}

const typescriptPackage = JSON.parse(await readFile(packagePath, 'utf8'))
typescriptPackage.toolpath = {
  openApiSha256: openApiChecksum.trim().split(/\s+/)[0],
  openApiVersion: releaseMetadata.apiVersion,
}
await writeFile(packagePath, `${JSON.stringify(typescriptPackage, null, 2)}\n`, 'utf8')

process.stdout.write('Generated TypeScript SDK source\n')
