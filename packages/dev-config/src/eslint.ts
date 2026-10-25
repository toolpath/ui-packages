import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import eslintReact from '@eslint-react/eslint-plugin'
import type { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import reactHooks from 'eslint-plugin-react-hooks'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export interface EslintOptions {
  /** The directory TypeScript resolves `tsconfig.json` from, usually `import.meta.dirname`. */
  tsconfigRootDir: string
  /** Adds the Hooks and React Compiler, React and accessibility rules for `.jsx` and `.tsx` files. */
  react?: boolean
  /** Globs to skip besides build output. */
  ignores?: Array<string>
}

const TYPESCRIPT = ['**/*.{ts,tsx,mts,cts}']
const SCRIPTS = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}']

/** Files that may import devDependencies: tests, stories, configuration and scripts. */
const DEVELOPMENT_FILES = [
  '**/*.{test,spec,stories}.*',
  '**/{test,tests,__tests__,e2e,scripts,.storybook}/**',
  '**/*.config.*',
]

/** ESLint core rules that catch real defects, and the few conventions every repository shares. */
const coreRules: Linter.RulesRecord = {
  'for-direction': 'error',
  'no-async-promise-executor': 'error',
  'no-case-declarations': 'error',
  'no-compare-neg-zero': 'error',
  'no-cond-assign': 'error',
  'no-constant-binary-expression': 'error',
  'no-constant-condition': 'error',
  'no-control-regex': 'error',
  'no-debugger': 'error',
  'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error',
  'no-empty': 'error',
  'no-empty-character-class': 'error',
  'no-empty-pattern': 'error',
  'no-ex-assign': 'error',
  'no-fallthrough': 'error',
  'no-global-assign': 'error',
  'no-invalid-regexp': 'error',
  'no-irregular-whitespace': 'error',
  'no-loss-of-precision': 'error',
  'no-misleading-character-class': 'error',
  'no-prototype-builtins': 'error',
  'no-regex-spaces': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-sparse-arrays': 'error',
  'no-unassigned-vars': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-unused-labels': 'error',
  'no-useless-backreference': 'error',
  'no-useless-catch': 'error',
  'no-useless-escape': 'error',
  'preserve-caught-error': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  curly: ['error', 'all'],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-eval': 'error',
  'no-new-func': 'error',
  'func-style': ['error', 'expression'],
  'prefer-arrow-callback': 'error',
}

/** The `eslint-plugin-unicorn` rules that catch defects; none of its style preset. */
const unicornRules: Linter.RulesRecord = {
  'unicorn/error-message': 'error',
  'unicorn/no-invalid-remove-event-listener': 'error',
  'unicorn/no-thenable': 'error',
  'unicorn/no-unnecessary-await': 'error',
  'unicorn/no-useless-spread': 'error',
  'unicorn/prefer-node-protocol': 'error',
  'unicorn/throw-new-error': 'error',
}

/**
 * import-x follows imports into TypeScript files only when it knows their
 * extensions and parser; without these it silently skips them (no cycles found).
 */
const importSettings = {
  'import-x/extensions': ['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx', '.cjs', '.mjs'],
  'import-x/external-module-folders': ['node_modules', 'node_modules/@types'],
  'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.cts', '.mts'] },
  'import-x/resolver-next': [createTypeScriptImportResolver()],
}

const importRules: Linter.RulesRecord = {
  'import-x/no-extraneous-dependencies': [
    'error',
    { devDependencies: DEVELOPMENT_FILES, optionalDependencies: false },
  ],
  'import-x/no-duplicates': 'error',
  'import-x/no-self-import': 'error',
  // Index segments stay: NodeNext resolution requires `./dir/index.js`.
  'import-x/no-useless-path-segments': 'error',
  'import-x/no-cycle': ['error', { ignoreExternal: true }],
}

/**
 * Rules an `eslint-disable` comment may not turn off. Each always has a fix that
 * is not a suppression (`void` for a deliberate floating promise, `satisfies` or
 * a type guard instead of an assertion, an explicit comparison, a declared
 * dependency). A repository that truly needs an exception writes it in its
 * `eslint.config.mjs`, where review sees it.
 */
const UNSUPPRESSIBLE = [
  '@eslint-community/eslint-comments/*',
  '@typescript-eslint/ban-ts-comment',
  '@typescript-eslint/consistent-type-assertions',
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-floating-promises',
  '@typescript-eslint/no-misused-promises',
  '@typescript-eslint/no-unsafe-*',
  // A narrowing TypeScript cannot express is a reviewed, explained disable.
  '!@typescript-eslint/no-unsafe-type-assertion',
  '@typescript-eslint/strict-boolean-expressions',
  'import-x/no-extraneous-dependencies',
  'no-eval',
  'no-new-func',
  'react-hooks/rules-of-hooks',
]

/**
 * Suppression discipline: every directive says why, none is file-wide or
 * unlimited, and the rules above cannot be suppressed at all.
 */
const commentRules: Linter.RulesRecord = {
  '@eslint-community/eslint-comments/require-description': 'error',
  '@eslint-community/eslint-comments/no-restricted-disable': ['error', ...UNSUPPRESSIBLE],
}

/** Adjustments to typescript-eslint's strict type-checked preset. */
const typescriptRules: Linter.RulesRecord = {
  '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
  // Assertions only as `as`, never on a literal (use `satisfies` or an annotation),
  // and never narrowing a type without proof (use a type guard or a parser).
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    {
      assertionStyle: 'as',
      objectLiteralTypeAssertions: 'never',
      arrayLiteralTypeAssertions: 'never',
    },
  ],
  '@typescript-eslint/no-unsafe-type-assertion': 'error',
  // Conditions are booleans, nullable booleans or nullable objects; `0` and `''`
  // are compared explicitly.
  '@typescript-eslint/strict-boolean-expressions': [
    'error',
    {
      allowString: false,
      allowNumber: false,
      allowNullableObject: true,
      allowNullableBoolean: true,
    },
  ],
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/prefer-optional-chain': 'error',
  '@typescript-eslint/require-array-sort-compare': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    },
  ],
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  '@typescript-eslint/switch-exhaustiveness-check': [
    'error',
    { considerDefaultExhaustiveForUnions: true },
  ],
}

/**
 * The shared ESLint flat config: core correctness, defect-finding unicorn and
 * import rules everywhere, typescript-eslint's strict type-checked rules for
 * TypeScript, and with `react`, the Hooks and React Compiler rules plus React
 * and accessibility rules. Disable directives must give a reason, may not be
 * file-wide, may not turn off the rules in `UNSUPPRESSIBLE`, and are errors when
 * they suppress nothing.
 *
 * ```js
 * // eslint.config.mjs
 * import { createEslintConfig } from '@toolpath/dev-config/eslint'
 *
 * export default createEslintConfig({ tsconfigRootDir: import.meta.dirname, react: true })
 * ```
 */
export const createEslintConfig = ({
  tsconfigRootDir,
  react = false,
  ignores = [],
}: EslintOptions): Array<Linter.Config> =>
  defineConfig(
    { ignores: ['**/dist/**', '**/build/**', '**/coverage/**', ...ignores] },
    { linterOptions: { reportUnusedDisableDirectives: 'error' } },
    {
      files: SCRIPTS,
      extends: [comments.recommended],
      languageOptions: { globals: { ...globals.browser, ...globals.node } },
      plugins: { 'import-x': importX, unicorn },
      settings: importSettings,
      rules: { ...coreRules, ...unicornRules, ...importRules, ...commentRules },
    },
    {
      files: TYPESCRIPT,
      extends: [tseslint.configs.strictTypeChecked],
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir } },
      rules: typescriptRules,
    },
    react
      ? [
          {
            files: ['**/*.{jsx,tsx}'],
            extends: [reactHooks.configs.flat['recommended-latest'], jsxA11y.configs.recommended],
          },
          // Type information finds leaked conditional rendering (`{count && <Badge />}`).
          { files: ['**/*.tsx'], extends: [eslintReact.configs['recommended-type-checked']] },
          { files: ['**/*.jsx'], extends: [eslintReact.configs.recommended] },
        ]
      : [],
  )
