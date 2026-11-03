# @toolpath/dev-config

## 0.2.0

### Minor Changes

- eab29af: Add `@toolpath/dev-config/eslint-package`: `createPackageEslintConfig({ forbidStyling, ignores })`,
  the correctness-only ESLint 9 config the Toolpath packages lint themselves with. `forbidStyling`
  bans styling imports and `className`/`style` attributes in `src/`.

### Patch Changes

- eab29af: Accept ESLint 9.39 as well as 10.4 as the `eslint` peer, since `./eslint-package` runs on either;
  `createEslintConfig` from `./eslint` still needs ESLint 10.4. The package config now takes its
  TypeScript parser and plugin from the `typescript-eslint` version the rest of the package uses.

## 0.1.0

### Minor Changes

- 0acc029: Add `@toolpath/dev-config`, shared development configuration for Toolpath repositories:
  - `@toolpath/dev-config/eslint`: `createEslintConfig({ tsconfigRootDir, react })`, a flat config
    with `@eslint/js` recommended, defect-finding `unicorn`, `regexp` (including ReDoS) and `import-x`
    rules (undeclared dependencies, cross-package relative imports, cycles), typescript-eslint's
    strict type-checked preset with safe type assertions and `strict-boolean-expressions`, Vitest
    rules for tests, and, with `react`, the Hooks/React Compiler, `@eslint-react` and accessibility
    presets. Every rule is an error or off. `eslint-disable` comments need a reason, may not be
    unlimited or turn off the rules in `UNSUPPRESSIBLE`, and comments may not configure rules;
    `createCommentAuditConfig()` checks the comments in CI with inline configuration disabled.
    Requires Node 22.13, ESLint 10.4 and TypeScript 6 (TypeScript 7 is not supported yet).
  - `@toolpath/dev-config/prettier`: the shared Prettier config.
  - `@toolpath/dev-config/tsconfig/{base,browser,node,library}.json`: strict TypeScript bases.
  - `@toolpath/dev-config/react-compiler`: the shared compiler options, a Vite plugin that fails a
    build the compiler did not run in and reports every function the compiler skipped, an esbuild
    plugin for tsup libraries that reports skipped functions at their location, and
    `assertReactCompiled` for library output. A function opted out with `'use no memo'` is not
    reported.
