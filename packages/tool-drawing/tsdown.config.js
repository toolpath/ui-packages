import pluginBabel from '@rolldown/plugin-babel'
import {
  assertReactCompiled,
  reactCompilerGuard,
  reactCompilerOptions,
} from '@toolpath/dev-config/react-compiler'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/geometry/index.ts', 'src/clearance/index.ts'],
  format: 'esm',
  platform: 'neutral',
  dts: true,
  clean: true,
  plugins: [
    pluginBabel({ plugins: [['babel-plugin-react-compiler', reactCompilerOptions()]] }),
    reactCompilerGuard(),
  ],
  hooks: {
    'build:done': () => {
      assertReactCompiled('dist')
    },
  },
})
