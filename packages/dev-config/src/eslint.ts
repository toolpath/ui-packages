import eslintReact from '@eslint-react/eslint-plugin'
import type { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import reactHooks from 'eslint-plugin-react-hooks'
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
const JSX = ['**/*.{jsx,tsx}']

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
}

/** Adjustments to typescript-eslint's strict type-checked preset. */
const typescriptRules: Linter.RulesRecord = {
  '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
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
 * The shared ESLint flat config: core correctness rules everywhere,
 * typescript-eslint's strict type-checked rules for TypeScript, and with
 * `react`, the Hooks and React Compiler rules plus React and accessibility rules.
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
    {
      files: SCRIPTS,
      languageOptions: { globals: { ...globals.browser, ...globals.node } },
      rules: coreRules,
    },
    {
      files: TYPESCRIPT,
      extends: [tseslint.configs.strictTypeChecked],
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir } },
      rules: typescriptRules,
    },
    react
      ? {
          files: JSX,
          extends: [
            reactHooks.configs.flat['recommended-latest'],
            eslintReact.configs.recommended,
            jsxA11y.configs.recommended,
          ],
        }
      : [],
  )
