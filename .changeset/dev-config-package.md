---
'@toolpath/dev-config': minor
---

Add `@toolpath/dev-config`, shared development configuration for Toolpath repositories:

- `@toolpath/dev-config/eslint`: `createEslintConfig({ tsconfigRootDir, react })`, a flat config
  with ESLint's correctness rules, typescript-eslint's strict type-checked preset and, with
  `react`, the Hooks/React Compiler, `@eslint-react` and accessibility presets.
- `@toolpath/dev-config/prettier`: the shared Prettier config.
- `@toolpath/dev-config/tsconfig/{base,browser,node,library}.json`: strict TypeScript bases.
- `@toolpath/dev-config/react-compiler`: the shared compiler options, a Vite plugin that fails a
  build the compiler did not run in, an esbuild plugin for tsup libraries, and
  `assertReactCompiled` for library output.
