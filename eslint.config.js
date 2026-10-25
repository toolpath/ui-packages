import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import { STYLED_PACKAGES, STYLING_IMPORTS } from './scripts/styling-home.mjs'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      // Linted by its own ESLint 10 policy: `pnpm --filter @toolpath/dev-config lint`,
      // which `pnpm lint:js` runs after this. Its tests hold deliberately invalid inputs.
      'packages/dev-config/**',
      'packages/sdk-python/**',
      'packages/sdk-typescript/src/generated/**',
      'packages/viewer/fixtures/**',
    ],
  },
  {
    // **Every TypeScript file, not just the React ones.** Until 2026-08-29 the
    // only `files` block here was `**/*.tsx`, and ESLint silently skips a file
    // no block matches — so `pnpm lint` passed over `packages/tool-scraper`
    // without reading a line of it, and "lint is clean" said nothing about the
    // largest package in the tree. A rule cannot be added where there is no
    // configuration to add it to, which made every structural convention in
    // that package a comment in a review rather than a check.
    //
    // Correctness rules only, and deliberately: the ones where a failure is a
    // real defect rather than a preference, not the ones that encode a style.
    // Prettier owns formatting, via the pre-commit hook.
    // `@typescript-eslint/eslint-plugin` is a devDependency for exactly one of
    // them, `no-unused-vars`, which needs declaration-space knowledge the core
    // rule does not have.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // A duplicate key silently discards the first value. In a scraper that
      // builds a CSV row as an object literal, that is a dropped column.
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-self-compare': 'error',
      'no-sparse-arrays': 'error',
      'no-constant-binary-expression': 'error',
      // `null`-permissive: `found != null` is the idiom for "neither null nor
      // undefined" and reads better than the two-branch spelling.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      // Core `no-unused-vars` has no type awareness — it reads the parameter
      // names in a type signature as unused variables, 136 of them across this
      // repo. The plugin's rule understands declaration space and reports only
      // real ones.
      'no-unused-vars': 'off',
      // The underscore is the opt-out, and it has to *be* one: a name is
      // exempt because somebody wrote `_` in front of it on purpose, which a
      // reviewer can then ask about. Eighteen places in this repo rely on it —
      // array-destructuring holes, a callback that takes the event and ignores
      // it — and they are all deliberate.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // **`@toolpath/ui` is the one home for styling.** Every other package's
    // shipped source is logic, data types and functions, so it imports no kit,
    // icon set, primitive, Tailwind or stylesheet, and renders no `className` or `style`.
    // `scripts/styling-home.mjs` holds the lists and the reason, and
    // `scripts/check-styling-home.mjs` covers what ESLint cannot read: a
    // stylesheet on disk, a `.tsx` file, and the manifests.
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    ignores: Object.keys(STYLED_PACKAGES).map((dir) => `${dir}/**`),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: STYLING_IMPORTS,
              message:
                'Styling belongs in @toolpath/ui. This package ships logic, data types and functions.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className']",
          message: 'Styling belongs in @toolpath/ui. Move this view into packages/ui.',
        },
        {
          selector: "JSXAttribute[name.name='style']",
          message: 'Styling belongs in @toolpath/ui. Move this view into packages/ui.',
        },
      ],
    },
  },
  {
    // **No underscore escape for a parameter in the shipped scraper library.**
    //
    // `packages/tool-scraper/src/` publishes contracts other modules call
    // against — `RecordMapper` hands a mapper the `ColumnMap` that `registry`
    // has just validated with `checkColumnsExist`. Harvey's mapper took that
    // argument as `_columns` and read `family.columns` instead, so it validated
    // one map and read another; they are the same object today and the
    // signature said they need not be. An underscore is a fine way to say "I
    // do not need this" in a callback and the wrong way to say it about a
    // contract, so here the parameter has to go or be used.
    //
    // `src/` only. Tests legitimately take an argument to ignore it — stubbing
    // a fetcher, matching a callback shape — and hold no contract for anyone.
    files: ['packages/tool-scraper/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      // A component defined inside another component is a new type on every
      // render, so React remounts its subtree instead of updating it. That
      // detaches the DOM node a pointer may be pressing, and the browser then
      // has no common ancestor to synthesize the click on.
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
      // Carried for the viewer's two deliberate suppressions: ESLint fails on a
      // disable comment naming a rule it cannot resolve, and reports one naming
      // a rule that is off as unused. The .tsx sources are already clean under
      // it, so it costs nothing to keep on.
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]
