import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import { describe, expect, it, vi } from 'vitest'
import {
  assertReactCompiled,
  reactCompilerEsbuildPlugin,
  reactCompilerGuard,
} from '../src/react-compiler.js'
import { temporaryDirectory } from './helpers.js'

const COMPILED = 'import { c as _c } from "react/compiler-runtime"\nexport const App = () => null\n'
const PLAIN = 'export const App = () => null\n'

/** Runs the guard over `modules` the way a build does; returns the error it raised, if any. */
const guard = (modules: Array<{ id: string; code: string; ssr?: boolean }>): string | undefined => {
  const plugin = reactCompilerGuard()
  const error = vi.fn((message: string): never => {
    throw new Error(message)
  })
  plugin.buildStart()
  for (const module of modules) {
    plugin.transform(module.code, module.id, { ssr: module.ssr ?? false })
  }
  try {
    plugin.buildEnd.call({ error })
  } catch (raised) {
    return (raised as Error).message
  }
  return undefined
}

describe('reactCompilerGuard', () => {
  it('passes a build in which the compiler compiled a component', () => {
    expect(
      guard([
        { id: '/app/src/App.tsx', code: COMPILED },
        { id: '/app/src/Plain.tsx', code: PLAIN },
      ]),
    ).toBeUndefined()
  })

  it('fails a build in which no component was compiled', () => {
    expect(guard([{ id: '/app/src/App.tsx', code: PLAIN }])).toMatch(
      /React Compiler did not run: none of 1 \.jsx\/\.tsx modules/,
    )
  })

  it('ignores server transforms and dependencies', () => {
    expect(
      guard([
        { id: '/app/src/App.tsx', code: PLAIN, ssr: true },
        { id: '/app/node_modules/lib/index.jsx', code: PLAIN },
      ]),
    ).toBeUndefined()
  })
})

describe('reactCompilerEsbuildPlugin and assertReactCompiled', () => {
  it('compile a library component and accept the build', async () => {
    const root = temporaryDirectory({
      'src/Counter.tsx': [
        "import { useState } from 'react'",
        '',
        'export const Counter = ({ label }: { label: string }) => {',
        '  const [count, setCount] = useState(0)',
        '  return <button onClick={() => setCount(count + 1)}>{label}: {count}</button>',
        '}',
        '',
      ].join('\n'),
    })
    await build({
      entryPoints: [join(root, 'src/Counter.tsx')],
      outdir: join(root, 'dist'),
      bundle: true,
      format: 'esm',
      jsx: 'automatic',
      external: ['react', 'react/*'],
      logLevel: 'silent',
      plugins: [reactCompilerEsbuildPlugin()],
    })
    expect(() => {
      assertReactCompiled(join(root, 'dist'))
    }).not.toThrow()
  })

  it('reject a build without compiler output', () => {
    const root = temporaryDirectory({ 'dist/index.js': PLAIN })
    writeFileSync(join(root, 'dist/other.mjs'), PLAIN)
    expect(() => {
      assertReactCompiled(join(root, 'dist'))
    }).toThrow(/none of the 2 JavaScript files/)
  })
})
