import { readdirSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The oldest React a project's shipped code supports. */
export type ReactCompilerTarget = '17' | '18' | '19'

export interface ReactCompilerOptions {
  compilationMode: 'infer'
  panicThreshold: 'none'
  target: ReactCompilerTarget
}

/**
 * The options every repository passes to `babel-plugin-react-compiler`: compile
 * what looks like a component or hook, and emit a function the compiler cannot
 * handle as written instead of failing the build.
 */
export const reactCompilerOptions = ({
  target = '19',
}: { target?: ReactCompilerTarget } = {}): ReactCompilerOptions => ({
  compilationMode: 'infer',
  panicThreshold: 'none',
  target,
})

/**
 * Compiled code imports the compiler runtime: `react/compiler-runtime` for
 * React 19, `react-compiler-runtime` for 17 and 18. Vite may rewrite the import
 * to a pre-bundled path such as `react_compiler-runtime.js`.
 */
const COMPILER_RUNTIME = /react[/_-]compiler-runtime/
const COMPONENT_MODULE = /\.[jt]sx(?:$|\?)/
const NODE_MODULES = /[\\/]node_modules[\\/]/

/** The parts of a Vite or Rollup plugin the guard uses; assignable to Vite's `Plugin`. */
export interface ReactCompilerGuardPlugin {
  name: string
  apply: 'build'
  enforce: 'post'
  buildStart: () => void
  transform: (code: string, id: string, options?: { ssr?: boolean }) => null
  buildEnd: (this: { error: (message: string) => never }, error?: Error) => void
}

/**
 * A Vite (or Rollup) plugin that fails a production build in which React
 * Compiler compiled none of the project's `.jsx` and `.tsx` modules: the
 * compiler is installed but the build does not run it. It wires nothing
 * itself; put it after the React plugin that runs the compiler.
 */
export const reactCompilerGuard = (): ReactCompilerGuardPlugin => {
  let modules = 0
  let compiled = 0
  return {
    name: 'toolpath:react-compiler-guard',
    apply: 'build',
    enforce: 'post',
    buildStart: () => {
      modules = 0
      compiled = 0
    },
    transform: (code, id, options) => {
      // Server builds may leave the compiler out on purpose; the client build is checked.
      if (options?.ssr !== true && COMPONENT_MODULE.test(id) && !NODE_MODULES.test(id)) {
        modules += 1
        if (COMPILER_RUNTIME.test(code)) {
          compiled += 1
        }
      }
      return null
    },
    buildEnd(error) {
      if (error === undefined && modules > 0 && compiled === 0) {
        this.error(
          `React Compiler did not run: none of ${String(modules)} .jsx/.tsx modules were compiled. ` +
            'Add babel-plugin-react-compiler to the React plugin with reactCompilerOptions() ' +
            '(see the @toolpath/dev-config README).',
        )
      }
    },
  }
}

type Loader = 'js' | 'jsx' | 'ts' | 'tsx'

/** The parts of an esbuild plugin this one uses; assignable to esbuild's and tsup's `Plugin`. */
export interface ReactCompilerEsbuildPlugin {
  name: string
  setup: (build: {
    onLoad: (
      options: { filter: RegExp },
      callback: (args: {
        path: string
      }) => Promise<{ contents: string; loader: Loader } | undefined>,
    ) => void
  }) => void
}

const loaderFor = (path: string): Loader => {
  const extension = /\.[cm]?([jt]sx?)$/.exec(path)?.[1]
  return extension === 'jsx' || extension === 'ts' || extension === 'tsx' ? extension : 'js'
}

/**
 * An esbuild plugin, for tsup and other esbuild library builds, that runs
 * React Compiler over each source file before esbuild lowers its TypeScript and
 * JSX. Needs `@babel/core` and `babel-plugin-react-compiler` installed.
 */
export const reactCompilerEsbuildPlugin = (
  options: ReactCompilerOptions = reactCompilerOptions(),
): ReactCompilerEsbuildPlugin => ({
  name: 'toolpath:react-compiler',
  setup: (build) => {
    build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async ({ path }) => {
      if (NODE_MODULES.test(path)) {
        return undefined
      }
      const loader = loaderFor(path)
      const { transformAsync } = await import('@babel/core')
      const result = await transformAsync(await readFile(path, 'utf8'), {
        filename: path,
        babelrc: false,
        configFile: false,
        sourceMaps: 'inline',
        // `.ts` files parse without JSX so `<T>value` casts still work.
        parserOpts: {
          plugins:
            loader === 'tsx' ? ['jsx', 'typescript'] : loader === 'ts' ? ['typescript'] : ['jsx'],
        },
        plugins: [['babel-plugin-react-compiler', options]],
      })
      return { contents: result?.code ?? '', loader }
    })
  },
})

/**
 * Throws unless a library build in `directory` contains React Compiler output.
 * Keep `react` external so the runtime import survives bundling. Call it after
 * the build, for example from tsup's `onSuccess`.
 */
export const assertReactCompiled = (directory: string): void => {
  const files = readdirSync(directory, { recursive: true, encoding: 'utf8' }).filter((file) =>
    /\.[cm]?js$/.test(file),
  )
  if (!files.some((file) => COMPILER_RUNTIME.test(readFileSync(join(directory, file), 'utf8')))) {
    throw new Error(
      `React Compiler did not run: none of the ${String(files.length)} JavaScript files in ${directory} ` +
        'imports its runtime. Add reactCompilerEsbuildPlugin() to the build and keep react external.',
    )
  }
}
