import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import { describe, expect, it, vi } from 'vitest'
import {
  assertReactCompiled,
  reactCompilerEsbuildPlugin,
  reactCompilerGuard,
  reactCompilerOptions,
  type ReactCompilerLogEvent,
  type ReactCompilerSkipAction,
} from '../src/react-compiler.js'
import { temporaryDirectory } from './helpers.js'

const COMPILED = 'import { c as _c } from "react/compiler-runtime"\nexport const App = () => null\n'
const PLAIN = 'export const App = () => null\n'

/** What the compiler logs for a component that reads a ref during render. */
const REFS_ERROR: ReactCompilerLogEvent = {
  kind: 'CompileError',
  fnLoc: { start: { line: 7, column: 0 } },
  detail: { reason: 'Cannot access refs during render', category: 'Refs' },
}

/** What the compiler logs for a component opted out with `'use no memo'`. */
const OPTED_OUT: ReactCompilerLogEvent = {
  kind: 'CompileSkip',
  fnLoc: { start: { line: 3, column: 30 } },
}

interface GuardModule {
  id: string
  code: string
  ssr?: boolean
  /** Events the compiler logs while the React plugin transforms this module. */
  logged?: Array<ReactCompilerLogEvent>
}

/** Runs the guard over `modules` the way a build does; returns what it raised and warned. */
const guard = (
  modules: Array<GuardModule>,
  onSkip?: ReactCompilerSkipAction,
): { error: string | undefined; warnings: Array<string> } => {
  const plugin = reactCompilerGuard(onSkip === undefined ? {} : { onSkip })
  const { logger } = reactCompilerOptions()
  const warnings: Array<string> = []
  const context = {
    error: vi.fn((message: string): never => {
      throw new Error(message)
    }),
    warn: (message: string) => {
      warnings.push(message)
    },
  }
  plugin.buildStart()
  for (const module of modules) {
    // Babel receives the module id as the bundler has it, query included.
    for (const event of module.logged ?? []) {
      logger.logEvent(module.id, event)
    }
    plugin.transform(module.code, module.id, { ssr: module.ssr ?? false })
  }
  try {
    plugin.buildEnd.call(context)
  } catch (raised) {
    return { error: (raised as Error).message, warnings }
  }
  return { error: undefined, warnings }
}

describe('reactCompilerGuard', () => {
  it('passes a build in which the compiler compiled a component', () => {
    expect(
      guard([
        { id: '/app/src/App.tsx', code: COMPILED },
        { id: '/app/src/Plain.tsx', code: PLAIN },
      ]).error,
    ).toBeUndefined()
  })

  it('fails a build in which no component was compiled', () => {
    expect(guard([{ id: '/app/src/App.tsx', code: PLAIN }]).error).toMatch(
      /React Compiler did not run: none of 1 \.jsx\/\.tsx modules/,
    )
  })

  it('ignores server transforms and dependencies', () => {
    const result = guard([
      { id: '/app/src/App.tsx', code: PLAIN, ssr: true, logged: [REFS_ERROR] },
      { id: '/app/node_modules/lib/index.jsx', code: PLAIN, logged: [REFS_ERROR] },
    ])
    expect(result).toEqual({ error: undefined, warnings: [] })
  })

  it('reports each skipped function once, as an error by default', () => {
    const modules = [
      { id: '/app/src/App.tsx', code: COMPILED },
      { id: '/app/src/Reader.tsx?v=1', code: COMPILED, logged: [REFS_ERROR, REFS_ERROR] },
    ]
    const { error } = guard(modules)
    expect(error).toMatch(/React Compiler skipped 1 function, which runs uncompiled/)
    expect(error).toMatch(/Reader\.tsx:7 {2}\[Refs\] Cannot access refs during render/)
    expect(error).toMatch(/'use no memo'/)
  })

  it('reports skips as warnings with onSkip: warn', () => {
    const result = guard(
      [{ id: '/app/src/Reader.tsx', code: COMPILED, logged: [REFS_ERROR] }],
      'warn',
    )
    expect(result.error).toBeUndefined()
    expect(result.warnings).toEqual([expect.stringMatching(/React Compiler skipped 1 function/)])
  })

  // Neither module imports the runtime, but the compiler logged both, so it ran.
  const allSkipped = [
    { id: '/app/src/Reader.tsx', code: PLAIN, logged: [REFS_ERROR] },
    { id: '/app/src/Legacy.tsx?v=1', code: PLAIN, logged: [OPTED_OUT] },
  ]

  it('reports the skips, not a missing compiler, when no component compiled', () => {
    const { error } = guard(allSkipped)
    expect(error).toMatch(/React Compiler skipped 1 function/)
    expect(error).not.toMatch(/did not run/)
  })

  it('passes with onSkip: warn when every component was skipped or opted out', () => {
    const result = guard(allSkipped, 'warn')
    expect(result.error).toBeUndefined()
    expect(result.warnings).toEqual([expect.stringMatching(/React Compiler skipped 1 function/)])
  })
})

describe('reactCompilerEsbuildPlugin and assertReactCompiled', () => {
  const COUNTER = [
    "import { useState } from 'react'",
    '',
    'export const Counter = ({ label }: { label: string }) => {',
    '  const [count, setCount] = useState(0)',
    '  return <button onClick={() => setCount(count + 1)}>{label}: {count}</button>',
    '}',
    '',
  ].join('\n')

  /** A component that reads a ref during render, which the compiler refuses to compile. */
  const reader = (directive: string): string =>
    [
      "import { useRef } from 'react'",
      '',
      'export const Reader = () => {',
      directive,
      '  const ref = useRef(0)',
      '  return <p>{ref.current}</p>',
      '}',
      '',
    ].join('\n')

  const bundle = async (
    files: Record<string, string>,
    onSkip?: ReactCompilerSkipAction,
  ): Promise<{ root: string; warnings: Array<string> }> => {
    const root = temporaryDirectory(files)
    const result = await build({
      entryPoints: Object.keys(files).map((file) => join(root, file)),
      outdir: join(root, 'dist'),
      bundle: true,
      format: 'esm',
      jsx: 'automatic',
      external: ['react', 'react/*'],
      logLevel: 'silent',
      plugins: [reactCompilerEsbuildPlugin(onSkip === undefined ? {} : { onSkip })],
    })
    return { root, warnings: result.warnings.map((warning) => warning.text) }
  }

  it('compile a library component and accept the build', async () => {
    const { root } = await bundle({ 'src/Counter.tsx': COUNTER })
    expect(() => {
      assertReactCompiled(join(root, 'dist'))
    }).not.toThrow()
  })

  it('fail the build at a function the compiler skipped', async () => {
    await expect(bundle({ 'src/Reader.tsx': reader('') })).rejects.toThrow(
      /React Compiler skipped this function, which runs uncompiled: \[Refs\]/,
    )
  })

  it("accept a function opted out with 'use no memo', and warn with onSkip: warn", async () => {
    const optedOut = await bundle({
      'src/Counter.tsx': COUNTER,
      'src/Reader.tsx': reader("  'use no memo' // reads a ref during render on purpose"),
    })
    expect(optedOut.warnings).toEqual([])
    const warned = await bundle({ 'src/Reader.tsx': reader('') }, 'warn')
    expect(warned.warnings).toEqual([expect.stringMatching(/React Compiler skipped this function/)])
  })

  it('reject a build without compiler output', () => {
    const root = temporaryDirectory({ 'dist/index.js': PLAIN })
    writeFileSync(join(root, 'dist/other.mjs'), PLAIN)
    expect(() => {
      assertReactCompiled(join(root, 'dist'))
    }).toThrow(/none of the 2 JavaScript files/)
  })
})
