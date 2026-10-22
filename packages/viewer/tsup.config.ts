import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defineConfig, type Options } from 'tsup'

type Plugin = NonNullable<Options['esbuildPlugins']>[number]

/**
 * `./x.js` to `./x.native.tsx` or `./x.native.ts`, where one exists.
 *
 * The sources import each other with `.js` specifiers, as Node's ESM
 * resolution wants. esbuild maps those to `.ts` and `.tsx` itself, but
 * `resolveExtensions` applies only to specifiers without an extension, so on
 * its own it never reaches a `.native` sibling.
 */
const nativeSiblings: Plugin = {
  name: 'native-siblings',
  setup(build) {
    build.onResolve({ filter: /^\.\.?\/.*\.js$/ }, (args) => {
      const base = resolve(dirname(args.importer), args.path.slice(0, -'.js'.length))
      for (const extension of ['.native.tsx', '.native.ts']) {
        if (existsSync(base + extension)) return { path: base + extension }
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
    onSuccess: 'node scripts/copy-assets.mjs web',
  },
  // The React Native build, behind the `react-native` export condition: the
  // same entries, with each `.native.ts(x)` file in place of its sibling.
  {
    entry,
    format: ['esm'],
    dts: false,
    clean: true,
    // A RegExp, since tsup reads a string external as a package name.
    external: [...external, 'react-native', 'expo-asset', 'expo-gl', /\.glb$/],
    outDir: 'dist/native',
    onSuccess: 'node scripts/copy-assets.mjs native',
    loader: { '.json': 'json' },
    esbuildPlugins: [nativeSiblings],
    esbuildOptions(options) {
      options.resolveExtensions = [
        '.native.tsx',
        '.native.ts',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.json',
      ]
    },
  },
] satisfies Options[])
