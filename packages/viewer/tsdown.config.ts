import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { defineConfig } from 'tsdown'

const SRC = resolve(import.meta.dirname, 'src')

// One clean of `dist/` for the three builds, before any of them writes: the native build and the
// Metro helper write inside the web build's `dist/`.
rmSync(join(import.meta.dirname, 'dist'), { recursive: true, force: true })

/**
 * A relative import to its `.native.tsx` or `.native.ts` file where one
 * exists, as Metro and `tsconfig.native.json`'s `moduleSuffixes` resolve it.
 *
 * The sources import `./x.js`, so both that and the extensionless form are
 * resolved here. A specifier with any other extension (`.json`, `.glb`) is
 * left to the bundler.
 *
 * A `.native` file that no import resolved to fails the build: it is dead, or
 * its web sibling shipped in its place.
 */
const platformFiles = () => {
  const used = new Set<string>()
  return {
    name: 'platform-files',
    resolveId: {
      order: 'pre' as const,
      handler(source: string, importer: string | undefined) {
        if (importer === undefined || !/^\.\.?\//.test(source)) return null
        const extension = extname(source)
        if (extension !== '' && extension !== '.js') return null
        const base = resolve(dirname(importer), source.slice(0, source.length - extension.length))
        for (const candidate of ['.native.tsx', '.native.ts']) {
          if (existsSync(base + candidate)) {
            used.add(base + candidate)
            return base + candidate
          }
        }
        return null
      },
    },
    buildEnd(this: { error: (message: string) => never }, error?: Error) {
      if (error !== undefined) return
      const unused = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
        // The entry is built, not imported.
        .filter((file) => /\.native\.tsx?$/.test(file) && file !== 'index.native.ts')
        .map((file) => join(SRC, file))
        .filter((file) => !used.has(file))
      if (unused.length > 0) {
        const names = unused.map((file) => relative(import.meta.dirname, file)).join(', ')
        this.error(`Never resolved: no import of the web sibling of ${names}`)
      }
    },
  }
}

/**
 * A model's import, kept as an import of the web build's copy, which Metro
 * bundles: `src/assets/x.glb` is `dist/assets/x.glb`, `../assets/x.glb` from
 * the native build's scripts in `dist/native/`.
 */
const webAssets = {
  name: 'web-assets',
  resolveId: {
    order: 'pre' as const,
    handler(source: string, importer: string | undefined) {
      if (importer === undefined || !source.endsWith('.glb')) return null
      const asset = relative(SRC, resolve(dirname(importer), source))
        .split(sep)
        .join('/')
      return { id: `../${asset}`, external: true }
    },
  },
}

const external = [/^react($|\/)/, /^react-dom($|\/)/, /^three($|\/)/, /^@react-three\//]

export default defineConfig([
  // The web build: what `import` resolves to.
  {
    entry: {
      index: 'src/index.ts',
      'engine/index': 'src/engine/index.ts',
      banana: 'src/banana/index.ts',
    },
    format: 'esm',
    platform: 'neutral',
    dts: true,
    clean: false,
    deps: { neverBundle: external },
    outDir: 'dist',
    hooks: {
      'build:done': () => {
        execFileSync('node', ['scripts/copy-assets.mjs'], { stdio: 'inherit' })
      },
    },
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
    format: 'esm',
    platform: 'neutral',
    // Declarations from the same graph, so a React Native app reads its own
    // props: `style` as a `View`'s, and no web-only exports.
    dts: true,
    clean: false,
    tsconfig: 'tsconfig.native.json',
    deps: { neverBundle: [...external, /^react-native($|\/)/, /^expo-asset/, /^expo-gl/] },
    outDir: 'dist/native',
    plugins: [platformFiles(), webAssets],
  },
  // `withToolpathViewer`, for an app's `metro.config.js`, which Node loads as CommonJS.
  {
    entry: { index: 'src/metro/index.ts' },
    format: 'cjs',
    platform: 'node',
    dts: true,
    clean: false,
    outDir: 'dist/metro',
  },
])
