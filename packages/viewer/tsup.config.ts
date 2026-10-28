import { existsSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { defineConfig, type Options } from 'tsup'

const SRC = resolve(import.meta.dirname, 'src')
const NATIVE = join(SRC, 'native')

type Plugin = NonNullable<Options['esbuildPlugins']>[number]

/** Every `.ts` and `.tsx` file under `src/native/`. */
const nativeFiles = (): Array<string> =>
  readdirSync(NATIVE, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => join(NATIVE, file))

/**
 * An import of a file under `src/` to the file at the same path under
 * `src/native/`, where one exists.
 *
 * The sources import each other with `.js` specifiers, as Node's ESM
 * resolution wants, and an extensionless one resolves the same way. esbuild
 * maps both to `.ts` and `.tsx` itself, but never to a native replacement. A
 * specifier with any other extension (`.json`, `.glb`) is left to esbuild.
 *
 * A native file that no import was swapped to fails the build: its web
 * sibling shipped in its place.
 */
const nativeSiblings: Plugin = {
  name: 'native-siblings',
  setup(build) {
    const swapped = new Set<string>()
    build.onStart(() => {
      swapped.clear()
    })
    build.onResolve({ filter: /^\.\.?\// }, (args) => {
      const extension = extname(args.path)
      if (extension !== '' && extension !== '.js') return undefined
      const specifier = extension === '.js' ? args.path.slice(0, -'.js'.length) : args.path
      const base = resolve(dirname(args.importer), specifier)
      const inSource = relative(SRC, base)
      if (inSource.startsWith('..') || inSource.startsWith(`native${sep}`)) return undefined
      for (const candidate of ['.tsx', '.ts']) {
        const replacement = join(NATIVE, inSource + candidate)
        if (existsSync(replacement)) {
          swapped.add(replacement)
          return { path: replacement }
        }
      }
      return undefined
    })
    build.onEnd((result) => {
      if (result.errors.length > 0) return undefined
      const unused = nativeFiles().filter((file) => !swapped.has(file))
      return {
        errors: unused.map((file) => ({
          text: `${relative(import.meta.dirname, file)} was never swapped in: no import of its web sibling reached it`,
        })),
      }
    })
  },
}

const entry = ['src/index.ts', 'src/engine/index.ts']
const external = ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei']

export default defineConfig([
  // The web build: what `import` resolves to, with the declarations both builds share.
  {
    entry,
    format: ['esm'],
    dts: true,
    // Everything in `dist/` but the native build, which the other configuration
    // writes at the same time.
    clean: ['!native', '!native/**'],
    external,
    outDir: 'dist',
    onSuccess: 'node scripts/copy-assets.mjs',
  },
  // The React Native build, behind the `react-native` export condition: the
  // same entries, with each `src/native/` file in place of the file at the
  // same path under `src/`.
  {
    entry,
    format: ['esm'],
    dts: false,
    clean: true,
    // A RegExp, since tsup reads a string external as a package name. The
    // model's import is kept as written, `../assets/banana.glb`, which from
    // `dist/native/` is the web build's copy: Metro bundles that one.
    external: [...external, 'react-native', 'expo-asset', 'expo-gl', /\.glb$/],
    outDir: 'dist/native',
    esbuildPlugins: [nativeSiblings],
  },
] satisfies Options[])
