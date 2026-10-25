import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { format } from 'prettier'
import { afterAll, describe, expect, it } from 'vitest'
import prettierConfig from '../../src/prettier/index.js'
import { createRepository, removeRepositories } from './fixture.js'

afterAll(removeRepositories)

const cli = fileURLToPath(new URL('../../dist/cli/main.js', import.meta.url))
const entry = pathToFileURL(fileURLToPath(new URL('../../dist/index.js', import.meta.url))).href

const config = `import { defineConfig } from '${entry}'

export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [
    {
      name: 'lib',
      root: '.',
      kind: 'library',
      runtime: 'node',
      tsconfig: 'tsconfig.json',
      noUnitTests: { reason: 'A formatting fixture with no behaviour to test' },
    },
  ],
  ci: { node: '24.18.0' },
})
`

/** A disposable repository whose files are already formatted with the shared policy. */
const formattedRepository = async (): Promise<string> => {
  const files: Record<string, string> = {
    'dev.config.mjs': config,
    'tsconfig.json': '{}\n',
    'src/sum.ts': 'export const sum = (left: number, right: number): number => left + right\n',
    'README.md': '# Fixture\n',
  }
  const formatted: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    formatted[path] = await format(content, { ...prettierConfig, filepath: path })
  }
  return createRepository(formatted)
}

const ci = (directory: string, ...args: Array<string>): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [cli, 'ci', '--config', join(directory, 'dev.config.mjs'), ...args], {
    cwd: directory,
    encoding: 'utf8',
  })

const receipt = (directory: string, id: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(directory, `${id}.json`), 'utf8')) as Record<string, unknown>

describe('toolpath-dev ci', () => {
  it('prints the execution plan as JSON', async () => {
    const directory = await formattedRepository()
    const result = ci(directory, '--plan')
    expect(result.status).toBe(0)
    const plan = JSON.parse(result.stdout) as {
      receipts: Array<string>
      standards: { unitSuites: Array<string> }
    }
    expect(plan.receipts).toEqual(['format', 'lint', 'types', 'unit'])
    expect(plan.standards.unitSuites).toEqual([])
  })

  it('passes the format backstop for formatted files and records a receipt', async () => {
    const directory = await formattedRepository()
    const receipts = createRepository({})
    const result = ci(directory, '--stage', 'format', '--receipt-dir', receipts)
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(receipt(receipts, 'format')).toMatchObject({
      kind: 'toolpath-dev/ci-receipt',
      id: 'format',
      status: 'passed',
    })
  })

  it('fails the format backstop for an unformatted file without changing it', async () => {
    const directory = await formattedRepository()
    const receipts = createRepository({})
    const unformatted = 'export const  doubled=( value:number )=>value*2;\n'
    writeFileSync(join(directory, 'src/doubled.ts'), unformatted)
    const result = ci(directory, '--stage', 'format', '--receipt-dir', receipts)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('src/doubled.ts')
    expect(result.stderr).toContain('pre-commit hook')
    expect(readFileSync(join(directory, 'src/doubled.ts'), 'utf8')).toBe(unformatted)
    expect(receipt(receipts, 'format')).toMatchObject({
      status: 'failed',
      message: 'format: 1 unformatted file',
    })
  })

  it('records an error receipt and exits 2 when a stage cannot run', async () => {
    const directory = await formattedRepository()
    const receipts = createRepository({})
    const result = ci(directory, '--stage', 'lint', '--receipt-dir', receipts)
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('eslint.config.mjs is missing')
    expect(receipt(receipts, 'lint')).toMatchObject({ status: 'error' })
    expect(readdirSync(receipts)).toEqual(['lint.json'])
  })

  it.each([
    [['--project', 'lib'], 'ci checks the whole repository'],
    [['--stage', 'bogus'], '--stage bogus: use standards, format, lint, types or unit.'],
    [['--stage', 'lint', '--suite', 'lib:unit'], 'ci takes --stage or --suite, not both.'],
    [['--suite', 'not a suite'], '--suite not a suite: use <project>:<suite>'],
    [['--plan', '--stage', 'lint'], '--plan prints the whole execution plan'],
  ])('rejects %j as an invalid invocation', async (args, message) => {
    const directory = await formattedRepository()
    const result = ci(directory, ...args)
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(message)
  })
})
