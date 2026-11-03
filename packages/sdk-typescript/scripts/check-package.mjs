import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Packs the built package, installs the tarball in a fresh npm fixture, and runs and
// type-checks a consumer against it. Run `pnpm build` first (`pnpm pack:check` does).
const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
const fixtureRoot = await mkdtemp(join(tmpdir(), 'toolpath-api-package-'))
const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

try {
  const packed = run('npm', ['pack', '--json', '--pack-destination', fixtureRoot], packageRoot)
  const [{ filename }] = JSON.parse(packed)
  const packageFile = join(fixtureRoot, filename)

  await writeFile(
    join(fixtureRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'toolpath-api-package-fixture',
        private: true,
        type: 'module',
        dependencies: { '@toolpath/api': `file:${packageFile}` },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    join(fixtureRoot, 'verify.mjs'),
    `import { JobFailedError, createToolpathClient, uploadToPresignedUrl, waitForJob } from '@toolpath/api'

const options = { apiKey: 'test-key', baseUrl: 'https://api.example.test' }
let apiRequest
const api = createToolpathClient({
  ...options,
  fetch: async (url, init) => {
    apiRequest = { url: String(url), init }
    return new Response(
      JSON.stringify({
        partId: 'part-123',
        uploadUrl: 'https://upload.example.test',
        sourceBucket: 'parts',
        sourceS3Key: 'part-123.step',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )
  },
})
const created = await api.parts.createPart({ filename: 'part.step' })
if (created.partId !== 'part-123') {
  throw new Error('createPart did not return the generated response type')
}
if (apiRequest.url !== 'https://api.example.test/v1/parts?filename=part.step') {
  throw new Error('createPart did not call the expected Engine API operation')
}
if (apiRequest.init.headers.Authorization !== 'Bearer test-key') {
  throw new Error('createPart did not authenticate the generated request')
}
if (typeof api.parts.createPart !== 'function') {
  throw new Error('createToolpathClient did not return named generated API clients')
}
let request
await uploadToPresignedUrl('https://upload.example.test', new Uint8Array([1, 2, 3]), {
  fetch: async (url, options) => {
    request = { url, options }
    return new Response(null, { status: 200 })
  },
})
if (request.url !== 'https://upload.example.test' || request.options.method !== 'PUT') {
  throw new Error('uploadToPresignedUrl did not make a PUT request to the presigned URL')
}
const job = {
  partUuid: 'part-123',
  holderUuid: null,
  jobUuid: 'job-123',
  productType: 'analyze-part',
  progress: 100,
  error: null,
  reportId: null,
  importId: null,
  createdAt: '2026-10-09T12:00:00.000Z',
  updatedAt: '2026-10-09T12:00:00.000Z',
  durationMs: 0,
}
const jobStream = (status) =>
  createToolpathClient({
    ...options,
    fetch: async () =>
      new Response(\`event: job\\ndata: \${JSON.stringify({ ...job, status })}\\n\\n\`, {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
  })
const finished = await waitForJob(jobStream('succeeded'), 'job-123')
if (finished.status !== 'succeeded') {
  throw new Error('waitForJob did not resolve with the succeeded job')
}
const failure = await waitForJob(jobStream('failed'), 'job-123').catch((error) => error)
if (!(failure instanceof JobFailedError) || failure.job.jobUuid !== 'job-123') {
  throw new Error('waitForJob did not reject a failed job with JobFailedError')
}
`,
  )
  await writeFile(
    join(fixtureRoot, 'consumer.ts'),
    `import { createToolpathClient, uploadToPresignedUrl, type ToolpathClient } from '@toolpath/api'

const client: ToolpathClient = createToolpathClient({ apiKey: 'test-key' })
void client
void client.parts.createPart({ filename: 'part.step' })
void uploadToPresignedUrl('https://upload.example.test', new Uint8Array())
`,
  )
  await writeFile(
    join(fixtureRoot, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          strict: true,
          target: 'ES2022',
        },
        include: ['consumer.ts'],
      },
      null,
      2,
    )}\n`,
  )

  run('npm', ['install', '--ignore-scripts', '--no-package-lock'], fixtureRoot)
  run(process.execPath, ['verify.mjs'], fixtureRoot)
  run(process.execPath, [tsc, '--project', fixtureRoot], fixtureRoot)
} finally {
  await rm(fixtureRoot, { recursive: true, force: true })
}

process.stdout.write('Verified the packed TypeScript SDK in a fresh npm fixture\n')
