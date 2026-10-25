import { resolveConfig, type ResolvedConfig, type ResolvedProject } from '../config/resolve.js'
import type { DevConfig, ReactAdapter, ReactMinimumVersion } from '../config/types.js'
import { CheckFailure, ConfigError } from '../errors.js'
import { importPeer, resolvePeer } from './peers.js'

/**
 * React Compiler policy shared by every adapter: the pinned Babel plugin in
 * `infer` mode, targeting the oldest React the project supports, with the
 * compiler's production-safe fallback (a component it cannot compile is left
 * as written rather than failing the build).
 */
export const COMPILER_PACKAGE = 'babel-plugin-react-compiler'

export type ReactCompilerTarget = ReactMinimumVersion

// A type alias rather than an interface, so it is assignable where Babel takes plain option records.
export type ReactCompilerOptions = {
  compilationMode: 'infer'
  target: ReactCompilerTarget
  panicThreshold: 'none'
}

/** The runtime module compiled code imports: React 19 ships it, 17/18 need `react-compiler-runtime`. */
export const compilerRuntimeModule = (
  target: ReactCompilerTarget,
): 'react/compiler-runtime' | 'react-compiler-runtime' =>
  target === '19' ? 'react/compiler-runtime' : 'react-compiler-runtime'

export interface ReactProjectSelection {
  /** The project name in `dev.config.mjs`. */
  project: string
}

export interface ReactProject {
  resolved: ResolvedConfig
  project: ResolvedProject & {
    react: { adapter: ReactAdapter; minimumVersion: ReactMinimumVersion }
  }
}

/** The declared React project an adapter is wired for, checked against the adapters it may use. */
export const selectReactProject = (
  config: DevConfig,
  { project: name }: ReactProjectSelection,
  adapters: ReadonlyArray<ReactAdapter>,
): ReactProject => {
  const resolved = resolveConfig(config)
  const project = resolved.projects.find((candidate) => candidate.name === name)
  if (!project) {
    throw new ConfigError(
      `No project "${name}" in dev.config.mjs (configured: ${resolved.projects.map((candidate) => candidate.name).join(', ')}).`,
    )
  }
  const react = project.react
  if (!react) {
    throw new ConfigError(
      `Project "${name}" declares no react profile. Add react: { adapter: '${adapters[0] ?? 'babel'}' } to it in dev.config.mjs.`,
    )
  }
  if (!adapters.includes(react.adapter)) {
    throw new ConfigError(
      `Project "${name}" declares the '${react.adapter}' React adapter; this factory implements ${adapters.map((adapter) => `'${adapter}'`).join(' and ')}. Use the factory for '${react.adapter}' (see docs/react.md).`,
    )
  }
  return { resolved, project: { ...project, react } }
}

/** The compiler options for one declared React project. */
export const reactCompilerOptions = (
  config: DevConfig,
  selection: ReactProjectSelection,
  adapters: ReadonlyArray<ReactAdapter> = [
    'vite-legacy',
    'vite-modern',
    'react-router',
    'expo',
    'library-esbuild',
    'babel',
  ],
): ReactCompilerOptions => {
  const { project } = selectReactProject(config, selection, adapters)
  return compilerOptionsFor(project.react.minimumVersion)
}

export const compilerOptionsFor = (target: ReactCompilerTarget): ReactCompilerOptions => ({
  compilationMode: 'infer',
  target,
  panicThreshold: 'none',
})

export interface CompilerEvidence {
  /** Whether the code holds compiler output: a memo cache allocated through the compiler runtime. */
  compiled: boolean
  /** The compiler runtime module the code imports, when it imports one. */
  runtimeModule?: string
  /** How many memo caches the code allocates. */
  cacheAllocations: number
  /** Whether the code compares against the compiler's memo-cache sentinel. */
  sentinel: boolean
}

/**
 * A module specifier naming the compiler runtime, also after a bundler or Vite's
 * import analysis rewrote it to a resolved path (`/node_modules/.vite/deps/react_compiler-runtime.js?v=…`).
 */
const RUNTIME_MODULES = '([^"\']*?(?:react[\\/_]compiler-runtime|react-compiler-runtime)[^"\']*)'
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Evidence that `code` is React Compiler output, independent of formatting,
 * minification, and module format: the binding the compiler runtime's `c` is
 * imported (or required) under, and memo caches allocated through it.
 */
export const inspectCompiledOutput = (code: string): CompilerEvidence => {
  let runtimeModule: string | undefined
  /** Names bound to the runtime's `c` itself. */
  const functions = new Set<string>()
  /** Names bound to the runtime module object, whose `.c` allocates the cache. */
  const namespaces = new Set<string>()

  // import { c as _c } from "react/compiler-runtime"
  const named = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${RUNTIME_MODULES}["']`, 'g')
  for (const match of code.matchAll(named)) {
    runtimeModule ??= match[2]
    for (const specifier of (match[1] ?? '').split(',')) {
      const [imported, local] = specifier.trim().split(/\s+as\s+/)
      if (imported === 'c') {
        functions.add(local ?? imported)
      }
    }
  }
  // import runtime from "…" / import * as runtime from "…" (Vite's CommonJS interop writes the former)
  const whole = new RegExp(
    `import\\s+(?:\\*\\s+as\\s+)?([\\w$]+)\\s+from\\s*["']${RUNTIME_MODULES}["']`,
    'g',
  )
  for (const match of code.matchAll(whole)) {
    runtimeModule ??= match[2]
    if (match[1]) {
      namespaces.add(match[1])
    }
  }
  // var runtime = require("…") / __toESM(require("…"))
  const required = new RegExp(
    `([\\w$]+)\\s*=\\s*(?:[\\w$]+\\()?require\\(\\s*["']${RUNTIME_MODULES}["']\\s*\\)`,
    'g',
  )
  for (const match of code.matchAll(required)) {
    runtimeModule ??= match[2]
    if (match[1]) {
      namespaces.add(match[1])
    }
  }
  // const _c = runtime["c"] / runtime.c
  for (const namespace of namespaces) {
    const alias = new RegExp(
      `(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*${escape(namespace)}(?:\\.c|\\[["']c["']\\])(?![\\w$])`,
      'g',
    )
    for (const match of code.matchAll(alias)) {
      if (match[1]) {
        functions.add(match[1])
      }
    }
  }

  const calls = [
    ...[...functions].map(
      (name) => new RegExp(`(?<![\\w$.])${escape(name)}\\(\\s*\\d+\\s*\\)`, 'g'),
    ),
    ...[...namespaces].map(
      (name) =>
        new RegExp(
          `(?:\\(0,\\s*${escape(name)}(?:\\.c|\\[["']c["']\\])\\)|(?<![\\w$.])${escape(name)}(?:\\.c|\\[["']c["']\\]))\\(\\s*\\d+\\s*\\)`,
          'g',
        ),
    ),
  ]
  const cacheAllocations = calls.reduce(
    (sum, pattern) => sum + [...code.matchAll(pattern)].length,
    0,
  )
  return {
    compiled: cacheAllocations > 0,
    ...(runtimeModule === undefined ? {} : { runtimeModule }),
    cacheAllocations,
    sentinel: code.includes('react.memo_cache_sentinel'),
  }
}

/** Throws a check failure naming what to wire when `code` holds no compiler output. */
export const assertCompiledOutput = (
  code: string,
  label: string,
  remedy: string,
): CompilerEvidence => {
  const evidence = inspectCompiledOutput(code)
  if (!evidence.compiled) {
    throw new CheckFailure(
      `${label}: React Compiler did not transform the probe component, so the compiler is installed but not part of this build. ${remedy}`,
    )
  }
  return evidence
}

interface CompilerEvent {
  kind: string
  fnName?: string | null
  reason?: string
}

export interface CompiledModule {
  code: string
  /** The Babel source map of the transform. */
  map: unknown
  /** The compiler's own diagnostics for this module (`CompileSuccess`, `CompileSkip`, `CompileError`, …). */
  events: Array<CompilerEvent>
}

interface BabelCore {
  transformAsync: (
    code: string,
    options: Record<string, unknown>,
  ) => Promise<{ code?: string | null; map?: unknown } | null>
}

/** Parser plugins for a file's syntax; `.ts` excludes JSX so `<T>value` casts still parse. */
const parserPluginsFor = (filename: string): Array<'jsx' | 'typescript'> => {
  if (/\.[cm]?tsx$/.test(filename)) {
    return ['jsx', 'typescript']
  }
  if (/\.[cm]?ts$/.test(filename)) {
    return ['typescript']
  }
  return ['jsx']
}

/**
 * Runs the compiler alone over one module, leaving TypeScript and JSX for the
 * build's own lowering. The library adapter and the Babel verification use
 * this; the compiler's logger records what it compiled or skipped.
 */
export const compileModule = async (
  source: string,
  {
    filename,
    directory,
    options,
    sourceMaps = true,
  }: {
    filename: string
    directory: string
    options: ReactCompilerOptions
    sourceMaps?: boolean | 'inline'
  },
): Promise<CompiledModule> => {
  const babel = await importPeer<{ default?: BabelCore } & Partial<BabelCore>>(
    directory,
    '@babel/core',
    'React Compiler',
  )
  const transformAsync = babel.transformAsync ?? babel.default?.transformAsync
  if (!transformAsync) {
    throw new ConfigError('@babel/core does not export transformAsync.')
  }
  const plugin = resolvePeer(directory, COMPILER_PACKAGE, 'React Compiler')
  const events: Array<CompilerEvent> = []
  const result = await transformAsync(source, {
    filename,
    cwd: directory,
    root: directory,
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    sourceMaps,
    parserOpts: { plugins: parserPluginsFor(filename) },
    plugins: [
      [
        plugin,
        {
          ...options,
          logger: {
            logEvent: (_file: string | null, event: CompilerEvent) => {
              events.push({
                kind: event.kind,
                ...(event.fnName === undefined ? {} : { fnName: event.fnName }),
                ...(event.reason === undefined ? {} : { reason: event.reason }),
              })
            },
          },
        },
      ],
    ],
  })
  return { code: result?.code ?? '', map: result?.map ?? null, events }
}

/** A small component the compiler always memoizes, used to prove a build path compiles. */
export const PROBE_COMPONENT = `import { useState } from 'react'

export const ToolpathCompilerProbe = ({ label }: { label: string }) => {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {label}: {count}
    </button>
  )
}
`
