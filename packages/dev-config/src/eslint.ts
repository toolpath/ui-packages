import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import eslintReact from '@eslint-react/eslint-plugin'
import js from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import type { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import reactHooks from 'eslint-plugin-react-hooks'
import regexp from 'eslint-plugin-regexp'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export interface EslintOptions {
  /** The directory TypeScript resolves `tsconfig.json` from, usually `import.meta.dirname`. */
  tsconfigRootDir: string
  /** Adds the Hooks and React Compiler, React and accessibility rules. */
  react?: boolean
  /** Globs to skip besides build output. */
  ignores?: Array<string>
}

/** Build output and generated files; flat config reads neither `.gitignore` nor dot-directories' intent. */
const BUILD_OUTPUT = [
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.react-router/**',
  '**/playwright-report/**',
  '**/test-results/**',
  '**/storybook-static/**',
]
const TYPESCRIPT = ['**/*.{ts,tsx,mts,cts}']
const JAVASCRIPT = ['**/*.{js,jsx,mjs,cjs}']
const SCRIPTS = [...TYPESCRIPT, ...JAVASCRIPT]
const JSX = ['**/*.{jsx,tsx}']
const TESTS = [
  '**/*.{test,spec,test-d,spec-d}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
  '**/{test,tests,__tests__,e2e,jest}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
]
const TYPESCRIPT_TESTS = [
  '**/*.{test,spec,test-d,spec-d}.{ts,tsx,mts,cts}',
  '**/{test,tests,__tests__,e2e,jest}/**/*.{ts,tsx,mts,cts}',
]

/** Files that may import devDependencies: tests and their setup, stories, configuration and scripts. */
const DEVELOPMENT_FILES = [
  ...TESTS,
  '**/*.{setup,stories}.*',
  '**/setupTests.*',
  '**/{scripts,.storybook}/**',
  '**/*.config.*',
]

/** `[prefix + rule, level]` for each rule: a preset's rules set to one severity. */
const atLevel = (
  prefix: string,
  rules: ReadonlyArray<string>,
  level: 'error' | 'off',
): Linter.RulesRecord =>
  Object.fromEntries(rules.map((rule): [string, Linter.RuleEntry] => [`${prefix}${rule}`, level]))

const unusedVars = {
  args: 'all',
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
  ignoreRestSiblings: true,
  // A `_` name that is read is not unused; the prefix must not hide live code.
  reportUsedIgnorePattern: true,
}

/**
 * Conventions and stricter options on top of `@eslint/js` recommended, which
 * supplies the correctness rules for JavaScript and TypeScript alike.
 */
const coreRules: Linter.RulesRecord = {
  curly: ['error', 'all'],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-self-compare': 'error',
  'no-template-curly-in-string': 'error',
  'no-unreachable-loop': 'error',
  'no-var': 'error',
  'prefer-const': 'error',
  // A named function expression keeps a component's name through memo and forwardRef.
  'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
  'no-fallthrough': ['error', { reportUnusedFallthroughComment: true }],
  'no-unsafe-optional-chaining': ['error', { disallowArithmeticOperators: true }],
  'preserve-caught-error': ['error', { requireCatchParameter: true }],
  'use-isnan': ['error', { enforceForIndexOf: true }],
  'valid-typeof': ['error', { requireStringLiterals: true }],
  'no-unused-vars': ['error', unusedVars],
  // eslint-plugin-regexp's versions of these supersede the core rules.
  'no-empty-character-class': 'off',
  'no-invalid-regexp': 'off',
  'no-useless-backreference': 'off',
}

/** The `eslint-plugin-unicorn` rules that catch defects; none of its style preset. */
const UNICORN = [
  // Errors, promises and modules
  'error-message',
  'no-invalid-remove-event-listener',
  'no-thenable',
  'no-unnecessary-await',
  'no-useless-spread',
  'prefer-node-protocol',
  'throw-new-error',
  // Logic slips: `a | b` in a condition, `2 ^ 8`, `total += total + n`, `a && a`
  'no-accessor-recursion',
  'no-accidental-bitwise-operator',
  'no-constant-zero-expression',
  'no-duplicate-logical-operands',
  'no-impossible-length-comparison',
  'no-incomplete-accessor-override',
  'no-instanceof-builtins',
  'no-invalid-character-comparison',
  'no-invalid-property-descriptor',
  'no-invalid-well-known-symbol-methods',
  'no-misrefactored-assignment',
  'no-negation-in-equality-check',
  'no-xor-as-exponentiation',
  'require-proxy-trap-boolean-return',
  // Async and event timing: `currentTarget` read after await, `resolve()` called twice
  'isolated-functions',
  'no-async-iterator-callback',
  'no-async-promise-finally',
  'no-await-in-promise-methods',
  'no-late-current-target-access',
  'no-late-event-control',
  'no-multiple-promise-resolver-calls',
  'no-prevent-default-in-passive-listener',
  'no-unsafe-promise-all-settled-values',
  // Discarded results and collections: a thrown-away `.map()`, `Array(n).fill([])`
  'no-array-fill-with-reference-type',
  'no-duplicate-set-values',
  'no-loop-iterable-mutation',
  'no-mismatched-map-key',
  'no-object-methods-with-collections',
  'no-unused-builtin-method-return',
  'no-unused-iterator-helper',
  'no-using-resource-escape',
  // HTML sinks and URL protocols (`url.protocol === 'https'` is never true)
  'no-invalid-url-protocol-comparison',
  'no-unsafe-dom-html',
]

/** eslint-plugin-regexp's correctness and ReDoS rules; none of its style rules. */
const REGEXP = [
  'confusing-quantifier',
  'no-contradiction-with-assertion',
  'no-dupe-characters-character-class',
  'no-dupe-disjunctions',
  'no-empty-alternative',
  'no-empty-capturing-group',
  'no-empty-character-class',
  'no-empty-group',
  'no-empty-lookarounds-assertion',
  'no-empty-string-literal',
  'no-escape-backspace',
  'no-extra-lookaround-assertions',
  'no-invalid-regexp',
  'no-invisible-character',
  'no-lazy-ends',
  'no-legacy-features',
  'no-misleading-capturing-group',
  'no-misleading-unicode-character',
  'no-missing-g-flag',
  'no-non-standard-flag',
  'no-obscure-range',
  'no-optional-assertion',
  'no-potentially-useless-backreference',
  'no-super-linear-backtracking',
  'no-useless-assertions',
  'no-useless-backreference',
  'no-useless-dollar-replacements',
  'no-zero-quantifier',
  'optimal-lookaround-quantifier',
  'strict',
]

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
  // A relative import into another package bypasses its declared exports.
  'import-x/no-relative-packages': 'error',
}

/**
 * Rules an `eslint-disable` comment may not turn off. Each always has a fix that
 * is not a suppression (`void` for a deliberate floating promise, `satisfies` or
 * a type guard instead of an assertion, an explicit comparison, a declared
 * dependency, a rewritten effect). A repository that truly needs an exception
 * writes it in its `eslint.config.mjs`, where review sees it.
 */
export const UNSUPPRESSIBLE: ReadonlyArray<string> = [
  '@eslint-community/eslint-comments/*',
  '@typescript-eslint/ban-ts-comment',
  '@typescript-eslint/consistent-type-assertions',
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-floating-promises',
  '@typescript-eslint/no-implied-eval',
  '@typescript-eslint/no-misused-promises',
  '@typescript-eslint/no-unsafe-*',
  // A narrowing TypeScript cannot express is a reviewed, explained disable.
  '!@typescript-eslint/no-unsafe-type-assertion',
  '@typescript-eslint/strict-boolean-expressions',
  'import-x/no-extraneous-dependencies',
  'no-eval',
  'no-implied-eval',
  'no-new-func',
  // Suppressing it also makes React Compiler skip the whole component.
  'react-hooks/exhaustive-deps',
  'react-hooks/rules-of-hooks',
  'vitest/no-focused-tests',
]

/**
 * Suppression discipline: every directive says why, none is file-wide or
 * unlimited, the rules above cannot be suppressed, and no comment may change
 * rule configuration (`/* eslint rule: "off" *\/`), only disable it.
 */
const commentRules: Linter.RulesRecord = {
  '@eslint-community/eslint-comments/require-description': 'error',
  '@eslint-community/eslint-comments/no-restricted-disable': ['error', ...UNSUPPRESSIBLE],
  '@eslint-community/eslint-comments/no-use': [
    'error',
    {
      allow: ['eslint-disable', 'eslint-disable-line', 'eslint-disable-next-line', 'eslint-enable'],
    },
  ],
}

/** Adjustments to typescript-eslint's strict type-checked preset. */
const typescriptRules: Linter.RulesRecord = {
  '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
  '@typescript-eslint/no-import-type-side-effects': 'error',
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
  '@typescript-eslint/restrict-template-expressions': [
    'error',
    {
      allowAny: false,
      allowArray: false,
      allowBoolean: false,
      allowNever: false,
      allowNullish: false,
      allowNumber: true,
      allowRegExp: false,
    },
  ],
  // A `default:` must not absorb a union member added later.
  '@typescript-eslint/switch-exhaustiveness-check': [
    'error',
    {
      allowDefaultCaseForExhaustiveSwitch: false,
      considerDefaultExhaustiveForUnions: false,
      requireDefaultForNonUnion: true,
    },
  ],
  // Method syntax makes parameters bivariant, a hole strictFunctionTypes leaves open.
  '@typescript-eslint/method-signature-style': ['error', 'property'],
  '@typescript-eslint/no-floating-promises': ['error', { checkThenables: true }],
  '@typescript-eslint/only-throw-error': [
    'error',
    { allowRethrowing: true, allowThrowingAny: false, allowThrowingUnknown: false },
  ],
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/prefer-optional-chain': 'error',
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/require-array-sort-compare': 'error',
  '@typescript-eslint/no-unused-vars': ['error', unusedVars],
}

/** Vitest's recommended rules, minus those that flag correct tests, plus focus and assertion discipline. */
const vitestRules: Linter.RulesRecord = {
  ...vitest.configs.recommended.rules,
  // Helper-based assertions and conditional expectations are common and correct.
  'vitest/expect-expect': 'off',
  'vitest/no-conditional-expect': 'off',
  'vitest/valid-title': 'off',
  // Its autofix rewrites `node --test` files into Vitest.
  'vitest/no-import-node-test': 'off',
  'vitest/valid-expect': ['error', { alwaysAwait: true, maxArgs: 2 }],
  'vitest/no-focused-tests': 'error',
  'vitest/no-disabled-tests': 'error',
  'vitest/warn-todo': 'error',
  'vitest/require-to-throw-message': 'error',
  'vitest/hoisted-apis-on-top': 'error',
  'vitest/prefer-import-in-mock': 'error',
}

/**
 * `@eslint-react` ports of rules eslint-plugin-react-hooks already runs with the
 * real compiler. `static-components` is not among them: its copy also catches a
 * component declared inside a render helper.
 */
const REACT_HOOKS_OWNS = [
  'error-boundaries',
  'exhaustive-deps',
  'purity',
  'rules-of-hooks',
  'set-state-in-effect',
  'set-state-in-render',
  'unsupported-syntax',
  'use-memo',
]

/** `@eslint-react` rules the presets leave at `warn` that catch defects or deprecated APIs. */
const REACT_ERRORS = [
  'dom-no-dangerously-set-innerhtml',
  'dom-no-script-url',
  'dom-no-unsafe-iframe-sandbox',
  'jsx-no-children-prop',
  'jsx-no-comment-textnodes',
  'jsx-no-leaked-dollar',
  'jsx-no-leaked-semicolon',
  'no-class-component',
  'no-context-provider',
  'no-duplicate-key',
  'no-forward-ref',
  'no-misused-capture-owner-stack',
  'no-set-state-in-component-did-mount',
  'no-set-state-in-component-did-update',
  'no-set-state-in-component-will-update',
  'no-unnecessary-use-prefix',
  'no-unsafe-component-will-mount',
  'no-unsafe-component-will-receive-props',
  'no-unsafe-component-will-update',
  'no-unused-class-component-members',
  'web-api-no-leaked-event-listener',
  'web-api-no-leaked-fetch',
  'web-api-no-leaked-intersection-observer',
  'web-api-no-leaked-interval',
  'web-api-no-leaked-resize-observer',
  'web-api-no-leaked-timeout',
]

/** `@eslint-react` rules the presets leave at `warn` that are naming, style or performance only. */
const REACT_OFF = [
  ...REACT_HOOKS_OWNS,
  'naming-convention-context-name',
  'naming-convention-id-name',
  'naming-convention-ref-name',
  'no-array-index-key',
  'no-children-count',
  'no-children-for-each',
  'no-children-map',
  'no-children-only',
  'no-children-to-array',
  'no-clone-element',
  'no-use-context',
  'use-state',
]

const reactConfigs = (): Array<Linter.Config> =>
  defineConfig(
    {
      // Hooks live in `.ts` files too.
      files: SCRIPTS,
      extends: [reactHooks.configs.flat['recommended-latest']],
      rules: {
        'react-hooks/exhaustive-deps': 'error',
        'react-hooks/incompatible-library': 'error',
        'react-hooks/unsupported-syntax': 'error',
      },
    },
    {
      files: JSX,
      extends: [jsxA11y.configs.recommended],
      rules: { 'jsx-a11y-x/lang': 'error', 'jsx-a11y-x/no-aria-hidden-on-focusable': 'error' },
    },
    // Type information finds leaked conditional rendering (`{count && <Badge />}`).
    { files: TYPESCRIPT, extends: [eslintReact.configs['recommended-type-checked']] },
    { files: JAVASCRIPT, extends: [eslintReact.configs.recommended] },
    {
      // No rule stays at `warn`: each preset warning is an error or off.
      files: SCRIPTS,
      rules: {
        ...atLevel('@eslint-react/', REACT_OFF, 'off'),
        ...atLevel('@eslint-react/', REACT_ERRORS, 'error'),
      },
    },
    {
      files: JSX,
      ignores: DEVELOPMENT_FILES,
      rules: { '@eslint-react/dom-no-missing-button-type': 'error' },
    },
  )

/**
 * The shared ESLint flat config: `@eslint/js` recommended and conventions,
 * defect-finding unicorn, regexp and import rules everywhere,
 * typescript-eslint's strict type-checked rules for TypeScript, Vitest rules for
 * tests, and with `react`, the Hooks and React Compiler, React and accessibility
 * rules. Every rule is an error or off. Disable directives must give a reason,
 * may not be file-wide, may not turn off the rules in `UNSUPPRESSIBLE`, and are
 * errors when they suppress nothing; comments may not configure rules.
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
    { ignores: [...BUILD_OUTPUT, ...ignores] },
    { linterOptions: { reportUnusedDisableDirectives: 'error' } },
    // `.jsx` holds JSX with or without the React rules; TypeScript parses `.tsx` by extension.
    { files: ['**/*.jsx'], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
    {
      files: SCRIPTS,
      extends: [js.configs.recommended, comments.recommended],
      languageOptions: { globals: { ...globals.browser, ...globals.node } },
      plugins: { 'import-x': importX, regexp, unicorn },
      settings: importSettings,
      rules: {
        ...coreRules,
        ...atLevel('unicorn/', UNICORN, 'error'),
        ...atLevel('regexp/', REGEXP, 'error'),
        ...importRules,
        ...commentRules,
      },
    },
    {
      files: TYPESCRIPT,
      extends: [tseslint.configs.strictTypeChecked],
      // `jsxPragma: null`: with the automatic JSX runtime, `import React` is not used by JSX.
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir, jsxPragma: null },
      },
      rules: typescriptRules,
    },
    {
      // Shipped code fixes a type instead of expecting an error; tests may assert one.
      files: TYPESCRIPT,
      ignores: TESTS,
      rules: {
        '@typescript-eslint/ban-ts-comment': [
          'error',
          { 'ts-check': false, 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true },
        ],
      },
    },
    { files: TESTS, plugins: { vitest }, rules: vitestRules },
    {
      // A wrong `!` or cast in a test fails the test loudly, so tests may use them to reach
      // into fixtures; the async and `no-unsafe-*` rules stay on. Vitest's `unbound-method`
      // understands `expect(mock.method)`.
      files: TYPESCRIPT_TESTS,
      rules: {
        '@typescript-eslint/consistent-type-assertions': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unsafe-type-assertion': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/unbound-method': 'off',
        'vitest/unbound-method': 'error',
      },
    },
    react ? reactConfigs() : [],
  )

/**
 * The comment rules alone, for a CI step run with `--no-inline-config` so no
 * comment can switch them off:
 * `eslint --no-inline-config -c eslint.comments-audit.config.mjs . --max-warnings=0`.
 */
export const createCommentAuditConfig = ({
  ignores = [],
}: { ignores?: Array<string> } = {}): Array<Linter.Config> =>
  defineConfig(
    { ignores: [...BUILD_OUTPUT, ...ignores] },
    {
      files: SCRIPTS,
      extends: [comments.recommended],
      languageOptions: { parser: tseslint.parser },
      rules: commentRules,
    },
  )
