---
'@toolpath/dev-config': minor
---

Add `@toolpath/dev-config`, shared development configuration for Toolpath repositories:

- `@toolpath/dev-config/eslint`: `createEslintConfig({ tsconfigRootDir, react })`, a flat config
  with ESLint's correctness rules, selected `unicorn` and `import-x` rules (including undeclared
  dependencies and import cycles), typescript-eslint's strict type-checked preset with safe type
  assertions and `strict-boolean-expressions`, explained and bounded `eslint-disable` comments
  (some rules cannot be disabled inline), and, with `react`, the Hooks/React Compiler,
  `@eslint-react` and accessibility presets. Requires Node 22.13 and ESLint 10.4 or later.
- `@toolpath/dev-config/prettier`: the shared Prettier config.
- `@toolpath/dev-config/tsconfig/{base,browser,node,library}.json`: strict TypeScript bases.
- `@toolpath/dev-config/react-compiler`: the shared compiler options, a Vite plugin that fails a
  build the compiler did not run in, an esbuild plugin for tsup libraries, and
  `assertReactCompiled` for library output.
