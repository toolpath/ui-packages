import { afterAll, describe, expect, it } from 'vitest'
import {
  compileModule,
  compilerOptionsFor,
  compilerRuntimeModule,
  inspectCompiledOutput,
  reactCompilerOptions,
} from '../../src/react/compiler.js'
import { ConfigError } from '../../src/errors.js'
import { COUNTER_SOURCE, createTestProject } from './project.js'

const project = createTestProject({ adapter: 'babel' })

afterAll(() => {
  project.remove()
})

describe('inspectCompiledOutput', () => {
  it('finds memo caches allocated through the ESM runtime import', () => {
    const code =
      'import { c as _c } from "react/compiler-runtime"\nexport const A = () => { const $ = _c(2); return $ }'
    expect(inspectCompiledOutput(code)).toEqual({
      compiled: true,
      runtimeModule: 'react/compiler-runtime',
      cacheAllocations: 1,
      sentinel: false,
    })
  })

  it('reads minified output and a runtime path rewritten by a bundler', () => {
    const minified =
      'import{c as e}from"/node_modules/.vite/deps/react_compiler-runtime.js?v=1a2b";const t=n=>{const r=e(3);if(r[0]===Symbol.for("react.memo_cache_sentinel"))r[0]=1;return r}'
    expect(inspectCompiledOutput(minified)).toMatchObject({
      compiled: true,
      cacheAllocations: 1,
      sentinel: true,
    })
  })

  it("reads Vite's CommonJS interop for a pre-bundled runtime", () => {
    const interop =
      'const _c = __vite__cjsImport0_react_compilerRuntime["c"];import __vite__cjsImport0_react_compilerRuntime from "/node_modules/.vite/deps/react_compiler-runtime.js?v=f3163328";\nexport const P = (t0) => { const $ = _c(7); return $ }'
    expect(inspectCompiledOutput(interop)).toMatchObject({ compiled: true, cacheAllocations: 1 })
  })

  it('reads CommonJS output', () => {
    const cjs =
      'var _compilerRuntime = require("react-compiler-runtime");\nfunction A() { const $ = (0, _compilerRuntime.c)(4); return $ }'
    expect(inspectCompiledOutput(cjs)).toEqual({
      compiled: true,
      runtimeModule: 'react-compiler-runtime',
      cacheAllocations: 1,
      sentinel: false,
    })
  })

  it('does not mistake a mention of the runtime for compiled code', () => {
    const mention = 'const runtime = "react/compiler-runtime"\nexport const c = (n) => n\nc(1)'
    expect(inspectCompiledOutput(mention).compiled).toBe(false)
    expect(inspectCompiledOutput(COUNTER_SOURCE).compiled).toBe(false)
  })
})

describe('compileModule', () => {
  it('compiles a TypeScript component and leaves TS and JSX for the build to lower', async () => {
    const source = `export type CounterProps = { label: string }\n${COUNTER_SOURCE}`
    const compiled = await compileModule(source, {
      filename: `${project.directory}/Counter.tsx`,
      directory: project.directory,
      options: compilerOptionsFor('19'),
    })
    expect(inspectCompiledOutput(compiled.code)).toMatchObject({
      compiled: true,
      runtimeModule: 'react/compiler-runtime',
    })
    expect(compiled.code).toContain('export type CounterProps')
    expect(compiled.code).toContain('<button')
    expect(compiled.events.map((event) => event.kind)).toContain('CompileSuccess')
  })

  it('targets older React through react-compiler-runtime', async () => {
    const compiled = await compileModule(COUNTER_SOURCE, {
      filename: `${project.directory}/Counter.tsx`,
      directory: project.directory,
      options: compilerOptionsFor('18'),
    })
    expect(inspectCompiledOutput(compiled.code).runtimeModule).toBe('react-compiler-runtime')
    expect(compilerRuntimeModule('18')).toBe('react-compiler-runtime')
    expect(compilerRuntimeModule('19')).toBe('react/compiler-runtime')
  })

  it('honours an explained "use no memo" opt-out and reports the skip', async () => {
    const source = `export const Chart = ({ points }: { points: Array<number> }) => {
  // The charting library mutates its props in place, which the compiler cannot model.
  'use no memo'
  return <svg>{points.length}</svg>
}
`
    const compiled = await compileModule(source, {
      filename: `${project.directory}/Chart.tsx`,
      directory: project.directory,
      options: compilerOptionsFor('19'),
    })
    expect(inspectCompiledOutput(compiled.code).compiled).toBe(false)
    expect(compiled.events.map((event) => event.kind)).toContain('CompileSkip')
  })

  it('emits a source map that points at the original file', async () => {
    const compiled = await compileModule(COUNTER_SOURCE, {
      filename: `${project.directory}/Counter.tsx`,
      directory: project.directory,
      options: compilerOptionsFor('19'),
    })
    expect(compiled.map).toMatchObject({ sources: [expect.stringContaining('Counter.tsx')] })
  })

  it('leaves a component it cannot compile as written instead of failing the build', async () => {
    const source = `let renders = 0
export const Counts = ({ label }: { label: string }) => {
  renders = renders + 1
  return <p>{label}{renders}</p>
}
`
    const compiled = await compileModule(source, {
      filename: `${project.directory}/Counts.tsx`,
      directory: project.directory,
      options: compilerOptionsFor('19'),
    })
    expect(compiled.code).toContain('renders = renders + 1')
    expect(inspectCompiledOutput(compiled.code).compiled).toBe(false)
    expect(compiled.events.map((event) => event.kind)).toContain('CompileError')
  })
})

describe('reactCompilerOptions', () => {
  it('uses infer mode, the project minimum as the target, and the safe fallback', () => {
    const older = createTestProject({
      adapter: 'library-esbuild',
      minimumVersion: '18',
      kind: 'library',
    })
    try {
      expect(reactCompilerOptions(older.config, { project: 'app' })).toEqual({
        compilationMode: 'infer',
        target: '18',
        panicThreshold: 'none',
      })
    } finally {
      older.remove()
    }
  })

  it('names the factory to use when a project declares another adapter', () => {
    expect(() => reactCompilerOptions(project.config, { project: 'app' }, ['vite-modern'])).toThrow(
      ConfigError,
    )
    expect(() => reactCompilerOptions(project.config, { project: 'missing' })).toThrow(
      /No project "missing"/,
    )
  })
})
