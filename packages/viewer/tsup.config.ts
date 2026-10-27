import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { defineConfig, type Options } from 'tsup'

const SRC = resolve(import.meta.dirname, 'src')
const NATIVE = join(SRC, 'native')

type Plugin = NonNullable<Options['esbuildPlugins']>[number]

/**
 * An import of a file under `src/` to the file at the same path under
 * `src/native/`, where one exists.
 *
 * The sources import each other with `.js` specifiers, as Node's ESM
 * resolution wants. esbuild maps those to `.ts` and `.tsx` itself, but never
 * to a native replacement.
 */
const nativeSiblings: Plugin = {
  name: 'native-siblings',
  setup(build) {
    build.onResolve({ filter: /^\.\.?\/.*\.js$/ }, (args) => {
      const base = resolve(dirname(args.importer), args.path.slice(0, -'.js'.length))
      const inSource = relative(SRC, base)
      if (inSource.startsWith('..') || inSource.startsWith(`native${sep}`)) return undefined
      for (const extension of ['.tsx', '.ts']) {
        const replacement = join(NATIVE, inSource + extension)
        if (existsSync(replacement)) return { path: replacement }
      }
      return undefined
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
