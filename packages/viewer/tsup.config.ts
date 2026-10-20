import { defineConfig, type Options } from 'tsup'

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
  },
  // The React Native build, behind the `react-native` export condition: the
  // same entries, with each `.native.ts(x)` file in place of its sibling.
  {
    entry,
    format: ['esm'],
    dts: false,
    clean: true,
    external: [...external, 'react-native', 'expo-asset', 'expo-gl', '*.glb'],
    outDir: 'dist/native',
    loader: { '.json': 'json' },
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
