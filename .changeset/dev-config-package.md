---
'@toolpath/dev-config': minor
---

Add `@toolpath/dev-config`, shared development configuration for Toolpath repositories:

- `@toolpath/dev-config/eslint`: `createEslintConfig({ tsconfigRootDir, react })`, a flat config
  with `@eslint/js` recommended, defect-finding `unicorn`, `regexp` (including ReDoS) and `import-x`
  rules (undeclared dependencies, cross-package relative imports, cycles), typescript-eslint's
  strict type-checked preset with safe type assertions and `strict-boolean-expressions`, Vitest
  rules for tests, and, with `react`, the Hooks/React Compiler, `@eslint-react` and accessibility
  presets. Every rule is an error or off. `eslint-disable` comments need a reason, may not be
  unlimited or turn off the rules in `UNSUPPRESSIBLE`, and comments may not configure rules;
  `createCommentAuditConfig()` checks the comments in CI with inline configuration disabled.
  Requires Node 22.13, ESLint 10.4 and TypeScript 6.0 or later.
- `@toolpath/dev-config/prettier`: the shared Prettier config.
- `@toolpath/dev-config/tsconfig/{base,browser,node,library}.json`: strict TypeScript bases.
- `@toolpath/dev-config/react-compiler`: the shared compiler options, a Vite plugin that fails a
  build the compiler did not run in, an esbuild plugin for tsup libraries, and
  `assertReactCompiled` for library output.
