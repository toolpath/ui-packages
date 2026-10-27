import { readdirSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, relative } from 'node:path'

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
  line: number
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

/** Where a file opts out of the compiler: the whole module, or functions by `line:column`. */
interface OptOuts {
  source: string
  module: boolean
  functions: Set<string>
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
  }
  if (ast !== null) {
    babel.traverse(ast, {
      Function: (path) => {
        const { body, loc } = path.node
        if (
          loc != null &&
          body.type === 'BlockStatement' &&
          body.directives.some((directive) => OPT_OUT.has(directive.value.value))
        ) {
          found.functions.add(`${String(loc.start.line)}:${String(loc.start.column)}`)
        }
      },
    })
  }
  optOutsByFile.set(filename, found)
  return found
}

const isOptedOut = (filename: string, event: ReactCompilerLogEvent): boolean => {
  try {
    const optOuts = optOutsOf(filename)
    const start = event.fnLoc?.start
    return (
      optOuts.module ||
      (start !== undefined &&
        optOuts.functions.has(`${String(start.line)}:${String(start.column)}`))
    )
  } catch {
    // A virtual module or unparsable file cannot opt out.
    return false
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
  if (isOptedOut(file, event)) {
    return
  }
  const line = event.fnLoc?.start.line ?? 1
  const key = `${file}:${String(line)}`
  // A function that fails several checks is reported once, with the first reason.
  if (!skips.has(key)) {
    const reason =
      event.detail === undefined
        ? (event.data ?? 'compiler pipeline error')
        : `[${event.detail.category}] ${event.detail.reason}`
    skips.set(key, { file, line, reason })
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
    .map((skip) => `  ${relative(process.cwd(), skip.file)}:${String(skip.line)}  ${skip.reason}`)
    .join('\n') +
  "\nFix what each reason names (lint reports most of them), or opt the function out with a 'use no memo' directive and a comment saying why."

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
      const loggedSkips = [...pendingSkips.values()].filter((skip) => skip.file === file)
      for (const skip of loggedSkips) {
        pendingSkips.delete(`${skip.file}:${String(skip.line)}`)
      }
      // Server builds may leave the compiler out on purpose; the client build is checked.
      if (options?.ssr !== true && !NODE_MODULES.test(file)) {
        for (const skip of loggedSkips) {
          skips.set(`${skip.file}:${String(skip.line)}`, skip)
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

/** A build message located at a skipped function; assignable to esbuild's `PartialMessage`. */
interface SkipMessage {
  text: string
  location: { file: string; line: number }
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
      const skips = new Map<string, ReactCompilerSkip>()
      const options = {
        ...reactCompilerOptions({ target }),
        logger: {
          logEvent: (filename: string | null, event: ReactCompilerLogEvent) => {
            recordSkip(skips, filename, event)
          },
        },
      }
      const { transformAsync } = await import('@babel/core')
      const result = await transformAsync(await readFile(path, 'utf8'), {
        filename: path,
        babelrc: false,
        configFile: false,
        sourceMaps: 'inline',
        parserOpts: { plugins: parserPlugins(path) },
        plugins: [['babel-plugin-react-compiler', options]],
      })
      const messages = [...skips.values()].map(
        (skip): SkipMessage => ({
          text: `React Compiler skipped this function, which runs uncompiled: ${skip.reason}. Fix it, or opt it out with a 'use no memo' directive and a comment saying why.`,
          location: { file: path, line: skip.line },
        }),
      )
      return {
        contents: result?.code ?? '',
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
