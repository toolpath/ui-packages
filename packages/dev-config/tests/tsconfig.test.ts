import { spawnSync } from 'node:child_process'
import { mkdirSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { temporaryDirectory } from './helpers.js'

const require = createRequire(import.meta.url)
const TSC = require.resolve('typescript/bin/tsc')
const BASES = fileURLToPath(new URL('../tsconfig/', import.meta.url))
const TYPES_NODE = fileURLToPath(new URL('../node_modules/@types/node', import.meta.url))

/** One fixture per safety flag, each written to trip exactly that flag. */
const FIXTURES: Record<string, { code: string; expected: Array<string> }> = {
  'ok.ts': { code: 'export const value: number = 1\n', expected: [] },
  'enum.ts': { code: 'export enum Direction {\n  Up,\n}\n', expected: ['TS1294'] },
  'index.ts': {
    code: 'export const first = (values: Array<number>): string => values[0].toFixed()\n',
    expected: ['TS2532'],
  },
  'exact.ts': {
    code: 'interface Options {\n  size?: number\n}\n\nexport const options: Options = { size: undefined }\n',
    expected: ['TS2375'],
  },
  'override.ts': {
    code: 'class Base {\n  run(): void {}\n}\n\nexport class Child extends Base {\n  run(): void {}\n}\n',
    expected: ['TS4114'],
  },
  'side-effect.ts': { code: "import './missing.js'\n", expected: ['TS2882'] },
  'returns.ts': {
    code: 'export const sign = (value: number): number | undefined => {\n  if (value > 0) {\n    return 1\n  }\n}\n',
    expected: ['TS7030'],
  },
}

/** The error codes `tsc` reports for each fixture file, compiling against `base`. */
const compile = (base: string): Record<string, Array<string>> => {
  const root = temporaryDirectory({
    'package.json': JSON.stringify({ type: 'module' }),
    'tsconfig.json': JSON.stringify({ extends: join(BASES, base), include: ['*.ts'] }),
    ...Object.fromEntries(Object.entries(FIXTURES).map(([file, { code }]) => [file, code])),
  })
  if (base === 'node.json') {
    mkdirSync(join(root, 'node_modules/@types'), { recursive: true })
    symlinkSync(TYPES_NODE, join(root, 'node_modules/@types/node'), 'dir')
  }
  const result = spawnSync(process.execPath, [TSC, '-p', '.', '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
  })
  const codes: Record<string, Array<string>> = Object.fromEntries(
    Object.keys(FIXTURES).map((file) => [file, []]),
  )
  for (const line of result.stdout.split('\n')) {
    const match = /^([\w-]+\.ts)\(\d+,\d+\): error (TS\d+)/.exec(line)
    if (match?.[1] !== undefined && match[2] !== undefined) {
      codes[match[1]]?.push(match[2])
    } else if (line.includes('error TS')) {
      throw new Error(`Unexpected diagnostic for ${base}: ${line}`)
    }
  }
  return codes
}

describe.each(['base.json', 'browser.json', 'node.json', 'library.json'])('%s', (base) => {
  // Each case runs tsc over the full DOM or Node type libraries (`skipLibCheck: false`), which
  // takes around ten seconds on a CI runner.
  it('compiles correct code and reports each safety flag', { timeout: 60_000 }, () => {
    expect(compile(base)).toEqual(
      Object.fromEntries(Object.entries(FIXTURES).map(([file, { expected }]) => [file, expected])),
    )
  })
})
