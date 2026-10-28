import { existsSync, readdirSync, rmSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { defineConfig, type Options } from 'tsup'

const SRC = resolve(import.meta.dirname, 'src')

// One clean of `dist/` for the three builds, before any of them writes. tsup's
// own `clean` deletes every declaration under its `outDir` once it has emitted
// its own, which for the web build's `dist/` would take the native build's and
// the Metro helper's with it whenever they were written first.
rmSync(join(import.meta.dirname, 'dist'), { recursive: true, force: true })

type Plugin = NonNullable<Options['esbuildPlugins']>[number]

/**
 * A relative import to its `.native.tsx` or `.native.ts` file where one
 * exists, as Metro and `tsconfig.native.json`'s `moduleSuffixes` resolve it.
 *
 * esbuild's `resolveExtensions` tries `.native.ts` only for an extensionless
 * specifier, and the sources import `./x.js`, so both forms are resolved here.
 * A specifier with any other extension (`.json`, `.glb`) is left to esbuild.
 *
 * A `.native` file that no import resolved to fails the build: it is dead, or
 * its web sibling shipped in its place.
 */
const platformFiles: Plugin = {
  name: 'platform-files',
  setup(build) {
    const used = new Set<string>()
    build.onStart(() => {
      used.clear()
    })
    build.onResolve({ filter: /^\.\.?\// }, (args) => {
      const extension = extname(args.path)
      if (extension !== '' && extension !== '.js') return undefined
      const base = resolve(args.resolveDir, args.path.slice(0, args.path.length - extension.length))
      for (const candidate of ['.native.tsx', '.native.ts']) {
        if (existsSync(base + candidate)) {
          used.add(base + candidate)
          return { path: base + candidate }
        }
      }
      return undefined
    })
    build.onEnd((result) => {
      if (result.errors.length > 0) return undefined
      const unused = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
        // The entry is built, not imported.
        .filter((file) => /\.native\.tsx?$/.test(file) && file !== 'index.native.ts')
        .map((file) => join(SRC, file))
        .filter((file) => !used.has(file))
      return {
        errors: unused.map((file) => ({
          text: `${relative(import.meta.dirname, file)} was never resolved: no import of its web sibling reached it`,
        })),
      }
    })
  },
}

/**
 * A model's import, kept as an import of the web build's copy, which Metro
 * bundles: `src/assets/x.glb` is `dist/assets/x.glb`, `../assets/x.glb` from
 * the native build's scripts in `dist/native/`.
 */
const webAssets: Plugin = {
  name: 'web-assets',
  setup(build) {
    build.onResolve({ filter: /\.glb$/ }, (args) => ({
      path: `../${relative(SRC, resolve(args.resolveDir, args.path)).split(sep).join('/')}`,
      external: true,
    }))
  },
}

const external = ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei']

export default defineConfig([
  // The web build: what `import` resolves to.
  {
    entry: {
      index: 'src/index.ts',
      'engine/index': 'src/engine/index.ts',
      banana: 'src/banana/index.ts',
    },
    format: ['esm'],
    dts: true,
    external,
    outDir: 'dist',
    onSuccess: 'node scripts/copy-assets.mjs',
  },
  // The React Native build, behind the `react-native` export condition: its
  // own root entry, with each import resolved to its `.native` file where
  // there is one.
  {
    entry: {
      index: 'src/index.native.ts',
      'engine/index': 'src/engine/index.ts',
      banana: 'src/banana/index.ts',
    },
    format: ['esm'],
    // Declarations from the same graph, so a React Native app reads its own
    // props: `style` as a `View`'s, and no web-only exports.
    dts: true,
    tsconfig: 'tsconfig.native.json',
    external: [...external, 'react-native', 'expo-asset', 'expo-gl'],
    outDir: 'dist/native',
    esbuildPlugins: [platformFiles, webAssets],
  },
  // `withToolpathViewer`, for an app's `metro.config.js`, which Node loads as CommonJS.
  {
    entry: { index: 'src/metro/index.ts' },
    format: ['cjs'],
    dts: true,
    platform: 'node',
    outDir: 'dist/metro',
  },
] satisfies Options[])
