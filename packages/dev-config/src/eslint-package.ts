import type { Linter } from 'eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export interface PackageEslintOptions {
  /**
   * Bans styling from `src/`: no kit, icon set, primitive, Tailwind or stylesheet import, and no
   * `className` or `style` attribute. On for every package except the ones that may style.
   */
  forbidStyling?: boolean
  /** Globs to skip besides build output and installs. */
  ignores?: Array<string>
}

/** Import specifiers only a styled package may name, as ESLint `no-restricted-imports` patterns. */
const STYLING_IMPORTS: ReadonlyArray<string> = [
  '@toolpath/ui',
  '@toolpath/ui/*',
  '@phosphor-icons/*',
  '@base-ui/*',
  'tailwindcss',
  '@tailwindcss/*',
  'clsx',
  'tailwind-merge',
  '*.css',
  '*.scss',
  '*.less',
]

const STYLING_MESSAGE = 'Styling belongs in @toolpath/ui. Move this view into packages/ui.'

const styling: Linter.Config = {
  // **`@toolpath/ui` is the one home for styling.** Every other package's
  // shipped source is logic, data types and functions, so it imports no kit,
  // icon set, primitive, Tailwind or stylesheet, and renders no `className` or
  // `style`.
  files: ['src/**/*.ts', 'src/**/*.tsx'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [...STYLING_IMPORTS],
            message:
              'Styling belongs in @toolpath/ui. This package ships logic, data types and functions.',
          },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      { selector: "JSXAttribute[name.name='className']", message: STYLING_MESSAGE },
      { selector: "JSXAttribute[name.name='style']", message: STYLING_MESSAGE },
    ],
  },
}

/**
 * The correctness-only ESLint config the public Toolpath packages lint themselves with, on
 * ESLint 9. Prettier owns formatting. `createEslintConfig` from `./eslint` is the stricter preset
 * for applications.
 *
 * ```js
 * // eslint.config.js
 * import { createPackageEslintConfig } from '@toolpath/dev-config/eslint-package'
 *
 * export default createPackageEslintConfig({ forbidStyling: true })
 * ```
 */
export const createPackageEslintConfig = ({
  forbidStyling = false,
  ignores = [],
}: PackageEslintOptions = {}): Array<Linter.Config> => [
  { ignores: ['**/dist/**', '**/node_modules/**', ...ignores] },
  {
    // **Every TypeScript file, not just the React ones.** ESLint silently skips
    // a file no block matches, so a `files` block for `**/*.tsx` alone lets a
    // package pass without a line of it read.
    //
    // Correctness rules only, and deliberately: the ones where a failure is a
    // real defect rather than a preference, not the ones that encode a style.
    // `@typescript-eslint/eslint-plugin` is here for exactly one of them,
    // `no-unused-vars`, which needs declaration-space knowledge the core rule
    // does not have.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
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
      // names in a type signature as unused variables. The plugin's rule
      // understands declaration space and reports only real ones.
      'no-unused-vars': 'off',
      // The underscore is the opt-out, and it has to *be* one: a name is
      // exempt because somebody wrote `_` in front of it on purpose, which a
      // reviewer can then ask about.
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
  ...(forbidStyling ? [styling] : []),
  {
    files: ['**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      // Their rules alone: neither plugin's legacy `configs` type-checks as an ESLint plugin.
      react: { rules: react.rules },
      'react-hooks': { rules: reactHooks.rules },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // A component defined inside another component is a new type on every
      // render, so React remounts its subtree instead of updating it. That
      // detaches the DOM node a pointer may be pressing, and the browser then
      // has no common ancestor to synthesize the click on.
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
      // Carried for the viewer's two deliberate suppressions: ESLint fails on a
      // disable comment naming a rule it cannot resolve, and reports one naming
      // a rule that is off as unused.
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]
