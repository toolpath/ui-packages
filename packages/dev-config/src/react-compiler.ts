import { readdirSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative, resolve } from 'node:path'

/** The oldest React a project's shipped code supports. */
export type ReactCompilerTarget = '17' | '18' | '19'

/**
 * The parts of a compiler log event the skip report reads;
 * babel-plugin-react-compiler's `LoggerEvent` is assignable to it.
 */
export interface ReactCompilerLogEvent {
  readonly kind: string
  readonly fnLoc?: { readonly start: { readonly line: number; readonly column: number } } | null
  readonly detail?: { readonly reason: string; readonly category: string }
  readonly data?: string
}

export interface ReactCompilerOptions {
  compilationMode: 'infer'
  panicThreshold: 'none'
  target: ReactCompilerTarget
  /** Records each function the compiler gives up on, for `reactCompilerGuard()`. */
  logger: { logEvent: (filename: string | null, event: ReactCompilerLogEvent) => void }
}

/** A function React Compiler tried and failed to compile; it runs as written. */
export interface ReactCompilerSkip {
  file: string
  /**
   * The function's line in `file`; `undefined` when another plugin rewrote the
   * module before the compiler, so the logged position is not one in the file.
   */
  line: number | undefined
  reason: string
}

/** What a build check does when the compiler skips a function. */
export type ReactCompilerSkipAction = 'error' | 'warn'

type Loader = 'js' | 'jsx' | 'ts' | 'tsx'

const loaderFor = (path: string): Loader => {
  const extension = /\.[cm]?([jt]sx?)$/.exec(path)?.[1]
  return extension === 'jsx' || extension === 'ts' || extension === 'tsx' ? extension : 'js'
}

/** Babel parser plugins for a file's syntax; `.ts` excludes JSX so `<T>value` casts still parse. */
const parserPlugins = (path: string): Array<'jsx' | 'typescript'> => {
  const loader = loaderFor(path)
  return loader === 'tsx' ? ['jsx', 'typescript'] : loader === 'ts' ? ['typescript'] : ['jsx']
}

const OPT_OUT = new Set(['use no memo', 'use no forget'])

/**
 * A file's functions by `line:column`, and where it opts out of the compiler:
 * the whole module, or single functions.
 */
interface OptOuts {
  source: string
  module: boolean
  functions: Set<string>
  starts: Set<string>
}

const optOutsByFile = new Map<string, OptOuts>()

/**
 * The compiler logs the same error for a function opted out with
 * `'use no memo'` as for one it failed on, so the opt-out is read from the
 * source. Only files with a failure are parsed, once per version of the file.
 */
const optOutsOf = (filename: string): OptOuts => {
  const source = readFileSync(filename, 'utf8')
  const cached = optOutsByFile.get(filename)
  if (cached?.source === source) {
    return cached
  }
  const babel = createRequire(import.meta.url)('@babel/core') as typeof import('@babel/core')
  const ast = babel.parseSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: parserPlugins(filename) },
  })
  const found: OptOuts = {
    source,
    module:
      ast?.program.directives.some((directive) => OPT_OUT.has(directive.value.value)) ?? false,
    functions: new Set(),
    starts: new Set(),
  }
  if (ast !== null) {
    babel.traverse(ast, {
      Function: (path) => {
        const { body, loc } = path.node
        if (loc == null) {
          return
        }
        const position = `${String(loc.start.line)}:${String(loc.start.column)}`
        found.starts.add(position)
        if (
          body.type === 'BlockStatement' &&
          body.directives.some((directive) => OPT_OUT.has(directive.value.value))
        ) {
          found.functions.add(position)
        }
      },
    })
  }
  optOutsByFile.set(filename, found)
  return found
}

/**
 * Where the file on disk places a function the compiler logged: opted out, at
 * the logged position, or nowhere. The compiler logs positions in the code
 * Babel received, so a plugin that rewrote the module before it (TanStack
 * Router's code splitting) leaves a position that names no function in the file.
 */
const placementOf = (
  filename: string,
  event: ReactCompilerLogEvent,
): 'opted-out' | 'found' | 'unmatched' => {
  try {
    const optOuts = optOutsOf(filename)
    if (optOuts.module) {
      return 'opted-out'
    }
    const start = event.fnLoc?.start
    if (start === undefined) {
      return 'found'
    }
    const position = `${String(start.line)}:${String(start.column)}`
    if (optOuts.functions.has(position)) {
      return 'opted-out'
    }
    return optOuts.starts.has(position) ? 'found' : 'unmatched'
  } catch {
    // A virtual module or unparsable file cannot opt out; its logged line stands.
    return 'found'
  }
}

/** A module id without its query; Babel receives the bundler's id (`route.tsx?route-chunk=main`). */
const withoutQuery = (id: string): string => id.split('?')[0] ?? id

/** The functions a log event reports as skipped, keyed by `file:line`. */
const recordSkip = (
  skips: Map<string, ReactCompilerSkip>,
  filename: string | null,
  event: ReactCompilerLogEvent,
): void => {
  if (filename === null || (event.kind !== 'CompileError' && event.kind !== 'PipelineError')) {
    return
  }
  const file = withoutQuery(filename)
  const placement = placementOf(file, event)
  if (placement === 'opted-out') {
    return
  }
  const logged = event.fnLoc?.start.line ?? 1
  // Keyed by the logged line, so functions stay apart where their line in the file is unknown.
  const key = `${file}:${String(logged)}`
  // A function that fails several checks is reported once, with the first reason.
  if (!skips.has(key)) {
    const reason =
      event.detail === undefined
        ? (event.data ?? 'compiler pipeline error')
        : `[${event.detail.category}] ${event.detail.reason}`
    skips.set(key, { file, line: placement === 'unmatched' ? undefined : logged, reason })
  }
}

/**
 * Functions skipped in this process, recorded by the logger in
 * `reactCompilerOptions()` while the React plugin transforms a module, and
 * claimed by `reactCompilerGuard()` right after.
 */
const pendingSkips = new Map<string, ReactCompilerSkip>()

/**
 * Files the compiler logged an event for in this process, claimed by
 * `reactCompilerGuard()` like their skips. The compiler logs every function it
 * compiles, skips or finds opted out, so a file here was compiled even when its
 * output has no compiler runtime import.
 */
const pendingReached = new Set<string>()

/**
 * The options every repository passes to `babel-plugin-react-compiler`: compile
 * what looks like a component or hook, and emit a function the compiler cannot
 * handle as written instead of failing the build. The logger records those
 * functions so `reactCompilerGuard()` can report them.
 */
export const reactCompilerOptions = ({
  target = '19',
}: { target?: ReactCompilerTarget } = {}): ReactCompilerOptions => ({
  compilationMode: 'infer',
  panicThreshold: 'none',
  target,
  logger: {
    logEvent: (filename, event) => {
      if (filename !== null) {
        pendingReached.add(withoutQuery(filename))
      }
      recordSkip(pendingSkips, filename, event)
    },
  },
})

const skipReport = (skips: ReadonlyArray<ReactCompilerSkip>): string =>
  `React Compiler skipped ${skips.length === 1 ? '1 function, which runs' : `${String(skips.length)} functions, which run`} uncompiled:\n` +
  skips
    .map((skip) =>
      skip.line === undefined
        ? `  ${relative(process.cwd(), skip.file)}  ${skip.reason} (line unknown: a plugin rewrote this module before React Compiler ran)`
        : `  ${relative(process.cwd(), skip.file)}:${String(skip.line)}  ${skip.reason}`,
    )
    .join('\n') +
  "\nFix what each reason names (lint reports most of them), or opt the function out with a 'use no memo' directive and a comment saying why." +
  (skips.some((skip) => skip.line === undefined)
    ? "\nA function's 'use no memo' cannot be matched in a module rewritten before the compiler; put 'use no memo' at the top of that module instead."
    : '')

/**
 * Compiled code imports the compiler runtime: `react/compiler-runtime` for
 * React 19, `react-compiler-runtime` for 17 and 18. Vite may rewrite the import
 * to a pre-bundled path such as `react_compiler-runtime.js`.
 */
const COMPILER_RUNTIME = /react[/_-]compiler-runtime/

/**
 * A library's import of the compiler runtime, minified or not, ESM or CommonJS.
 * A build that bundles react names the runtime only in path comments and module
 * keys, which this does not match.
 */
const RUNTIME_IMPORT = /(?:from|import|require)\s*\(?\s*["'](?:react\/|react-)compiler-runtime["']/
const COMPONENT_MODULE = /\.[jt]sx(?:$|\?)/
const NODE_MODULES = /[\\/]node_modules[\\/]/

/** The parts of a Vite or Rollup plugin the guard uses; assignable to Vite's `Plugin`. */
export interface ReactCompilerGuardPlugin {
  name: string
  apply: 'build'
  enforce: 'post'
  buildStart: () => void
  transform: (code: string, id: string, options?: { ssr?: boolean | undefined }) => null
  buildEnd: (
    this: { error: (message: string) => never; warn: (message: string) => void },
    error?: Error,
  ) => void
}

/**
 * A Vite (or Rollup) plugin for production client builds. It fails the build
 * when React Compiler ran on none of the project's `.jsx` and `.tsx` modules
 * (the compiler is installed but the build does not run it), and reports every
 * function the compiler skipped, as an error by default. It wires nothing
 * itself; put it after the React plugin, which must run the compiler with
 * `reactCompilerOptions()`.
 */
export const reactCompilerGuard = ({
  onSkip = 'error',
}: { onSkip?: ReactCompilerSkipAction } = {}): ReactCompilerGuardPlugin => {
  let modules = 0
  let reached = 0
  const skips = new Map<string, ReactCompilerSkip>()
  return {
    name: 'toolpath:react-compiler-guard',
    apply: 'build',
    enforce: 'post',
    buildStart: () => {
      modules = 0
      reached = 0
      skips.clear()
    },
    transform: (code, id, options) => {
      const file = withoutQuery(id)
      // The compiler logged this module during the React plugin's transform, just before.
      const logged = pendingReached.delete(file)
      const loggedSkips = [...pendingSkips].filter(([, skip]) => skip.file === file)
      for (const [key] of loggedSkips) {
        pendingSkips.delete(key)
      }
      // Server builds may leave the compiler out on purpose; the client build is checked.
      if (options?.ssr !== true && !NODE_MODULES.test(file)) {
        for (const [key, skip] of loggedSkips) {
          skips.set(key, skip)
        }
        if (COMPONENT_MODULE.test(id)) {
          modules += 1
          // A module whose functions were all skipped or opted out has no runtime import.
          if (logged || COMPILER_RUNTIME.test(code)) {
            reached += 1
          }
        }
      }
      return null
    },
    buildEnd(error) {
      if (error !== undefined) {
        return
      }
      if (modules > 0 && reached === 0) {
        this.error(
          `React Compiler did not run: none of ${String(modules)} .jsx/.tsx modules were compiled. ` +
            "Run babel-plugin-react-compiler with reactCompilerOptions() in the build's Babel step " +
            '(see the @toolpath/dev-config README).',
        )
      }
      if (skips.size > 0) {
        const report = skipReport([...skips.values()])
        if (onSkip === 'error') {
          this.error(report)
        }
        this.warn(report)
      }
    },
  }
}

/** A build message located in a source file; assignable to esbuild's `PartialMessage`. */
interface SkipMessage {
  text: string
  location: { file: string; line?: number; column?: number }
}

/** Where Babel's parser failed, when `error` is a parse error. */
const syntaxErrorLocation = (error: unknown): { line: number; column: number } | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error) || !('loc' in error)) {
    return undefined
  }
  const { code, loc } = error
  // `@babel/core` reports a parse error as BABEL_PARSE_ERROR, its parser as BABEL_PARSER_SYNTAX_ERROR.
  if (
    (code !== 'BABEL_PARSE_ERROR' && code !== 'BABEL_PARSER_SYNTAX_ERROR') ||
    typeof loc !== 'object' ||
    loc === null ||
    !('line' in loc) ||
    !('column' in loc) ||
    typeof loc.line !== 'number' ||
    typeof loc.column !== 'number'
  ) {
    return undefined
  }
  return { line: loc.line, column: loc.column }
}

/**
 * The compiler plugin as this package resolves it, its optional peer, so the
 * build does not depend on the working directory; Babel resolves the bare name
 * from the working directory otherwise.
 */
const compilerPlugin = (): string => {
  try {
    return createRequire(import.meta.url).resolve('babel-plugin-react-compiler')
  } catch {
    return 'babel-plugin-react-compiler'
  }
}

interface CompiledSource {
  code: string
  map: {
    version: number
    sources: Array<string>
    names: Array<string>
    sourcesContent?: Array<string> | undefined
    mappings: string
  } | null
  skips: Array<ReactCompilerSkip>
}

/** One compiler invocation shared by production builds and compiler-enabled tests. */
const compileReactSource = async (
  code: string,
  filename: string,
  target: ReactCompilerTarget,
): Promise<CompiledSource> => {
  const skips = new Map<string, ReactCompilerSkip>()
  const options = {
    ...reactCompilerOptions({ target }),
    logger: {
      logEvent: (file: string | null, event: ReactCompilerLogEvent) => {
        recordSkip(skips, file, event)
      },
    },
  }
  const { transformAsync } = await import('@babel/core')
  const result = await transformAsync(code, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: 'both',
    retainLines: true,
    parserOpts: { plugins: parserPlugins(filename) },
    plugins: [[compilerPlugin(), options]],
  })
  if (result?.code == null) {
    throw new Error(`React Compiler produced no code for ${filename}`)
  }
  return { code: result.code, map: result.map ?? null, skips: [...skips.values()] }
}

/** A Vite plugin usable in Vitest without depending on a particular Vite major. */
export interface ReactCompilerTestPlugin {
  name: string
  enforce: 'pre'
  transform: (code: string, id: string) => Promise<Pick<CompiledSource, 'code' | 'map'> | null>
}

/**
 * Compile loaded source modules before Vite lowers TypeScript and JSX, regardless
 * of whether a test imports a public entry point or an internal module. Use only
 * in the compiler-enabled test run; production builds use their build integration.
 * Tests, configs, dependencies and files outside the source directories are excluded.
 * Compiler skips fail the test run, just as they fail an esbuild library build.
 */
export const reactCompilerTestPlugin = ({
  root,
  sourceDirectories = ['src'],
  target = '19',
}: {
  root: string
  sourceDirectories?: Array<string>
  target?: ReactCompilerTarget
}): ReactCompilerTestPlugin => {
  const directories = sourceDirectories.map((directory) => resolve(root, directory))
  return {
    name: 'toolpath:react-compiler-tests',
    enforce: 'pre',
    transform: async (code, id) => {
      const file = withoutQuery(id)
      // Relative, so a `tests` directory above the checkout does not exclude the whole source.
      const sourcePath = directories
        .map((directory) => relative(directory, file))
        .find(
          (path) =>
            path !== '..' &&
            !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
            !isAbsolute(path),
        )
      if (
        sourcePath === undefined ||
        !/\.[cm]?[jt]sx?$/.test(file) ||
        /\.d\.[cm]?ts$/.test(file) ||
        NODE_MODULES.test(file) ||
        /(?:^|[/\\])(?:__tests__|tests?|__mocks__)(?:[/\\])|\.(?:test|spec|setup|config)\.[cm]?[jt]sx?$/.test(
          sourcePath,
        )
      ) {
        return null
      }
      const result = await compileReactSource(code, file, target)
      if (result.skips.length > 0) {
        throw new Error(skipReport(result.skips))
      }
      return { code: result.code, map: result.map }
    },
  }
}

/** The parts of an esbuild plugin this one uses; assignable to esbuild's and tsup's `Plugin`. */
export interface ReactCompilerEsbuildPlugin {
  name: string
  setup: (build: {
    onLoad: (
      options: { filter: RegExp },
      callback: (args: { path: string }) => Promise<
        | {
            contents: string
            loader: Loader
            errors: Array<SkipMessage>
            warnings: Array<SkipMessage>
          }
        | undefined
      >,
    ) => void
  }) => void
}

/**
 * An esbuild plugin, for tsup and other esbuild library builds, that runs
 * React Compiler over each source file before esbuild lowers its TypeScript and
 * JSX, and reports each function the compiler skipped at its location, as an
 * error by default. Needs `@babel/core` and `babel-plugin-react-compiler`
 * installed.
 */
export const reactCompilerEsbuildPlugin = ({
  target = '19',
  onSkip = 'error',
}: {
  target?: ReactCompilerTarget
  onSkip?: ReactCompilerSkipAction
} = {}): ReactCompilerEsbuildPlugin => ({
  name: 'toolpath:react-compiler',
  setup: (build) => {
    build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async ({ path }) => {
      if (NODE_MODULES.test(path)) {
        return undefined
      }
      const loader = loaderFor(path)
      let result: CompiledSource
      try {
        result = await compileReactSource(await readFile(path, 'utf8'), path, target)
      } catch (error) {
        const location = syntaxErrorLocation(error)
        if (location === undefined) {
          throw error
        }
        // Reported in the file that failed to parse, not at the import that loaded it.
        const reason = error instanceof Error ? error.message.split('\n')[0] : undefined
        return {
          contents: '',
          loader,
          errors: [
            {
              text: `Babel could not parse this file for React Compiler: ${(reason ?? '').replace(`${path}: `, '')}`,
              location: { file: path, ...location },
            },
          ],
          warnings: [],
        }
      }
      const messages = result.skips.map((skip): SkipMessage => ({
        text: `React Compiler skipped this function, which runs uncompiled: ${skip.reason}. Fix it, or opt it out with a 'use no memo' directive and a comment saying why.`,
        location: skip.line === undefined ? { file: path } : { file: path, line: skip.line },
      }))
      return {
        contents: result.code,
        loader,
        errors: onSkip === 'error' ? messages : [],
        warnings: onSkip === 'warn' ? messages : [],
      }
    })
  },
})

/**
 * Throws unless a library build in `directory` contains React Compiler output.
 * Keep `react` external so the runtime import survives bundling. Call it after
 * the build, for example from tsup's `onSuccess`. Output alone cannot show that
 * the compiler ran, so a build in which it skipped or opted out every function
 * fails too.
 */
export const assertReactCompiled = (directory: string): void => {
  const files = readdirSync(directory, { recursive: true, encoding: 'utf8' }).filter((file) =>
    /\.[cm]?js$/.test(file),
  )
  if (!files.some((file) => RUNTIME_IMPORT.test(readFileSync(join(directory, file), 'utf8')))) {
    throw new Error(
      `No React Compiler output: none of the ${String(files.length)} JavaScript files in ${directory} ` +
        'imports its runtime. Add reactCompilerEsbuildPlugin() to the build and keep react external. ' +
        'If the build reported every function as skipped or opted out, compile at least one.',
    )
  }
}
