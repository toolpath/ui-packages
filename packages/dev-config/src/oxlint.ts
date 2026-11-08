import { fileURLToPath } from 'node:url'
import type { OxlintConfig } from 'oxlint'
import { STYLING_IMPORT_MESSAGE, STYLING_IMPORTS, STYLING_SOURCE } from './styling.js'

export interface OxlintConfigOptions {
  /** Adds the Hooks and React Compiler, React and accessibility rules. */
  react?: boolean
  /**
   * Bans styling from `src/`: no kit, icon set, primitive, Tailwind or stylesheet import, and no
   * `className` or `style` attribute. On for every package except the ones that may style.
   */
  forbidStyling?: boolean
  /** Globs to skip besides build output. */
  ignores?: Array<string>
}

type Rules = NonNullable<OxlintConfig['rules']>

/** Installs, build output and generated files; oxlint only skips what `.gitignore` names. */
const BUILD_OUTPUT = [
  '**/node_modules/**',
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
const JSX = ['**/*.{jsx,tsx}']
const TESTS = [
  '**/*.{test,spec,test-d,spec-d}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
  '**/{test,tests,__tests__,e2e,jest}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
]

/** Files that may import devDependencies: tests and their setup, stories, configuration and scripts. */
const DEVELOPMENT_FILES = [
  ...TESTS,
  '**/*.{setup,stories}.*',
  '**/setupTests.*',
  '**/{scripts,.storybook}/**',
  '**/*.config.*',
  '**/vite.*',
  '**/*-test-support.*',
  // React Router's route table imports `@react-router/dev`, and only its build reads the file.
  '**/app/routes.ts',
]

/** `[prefix + rule, 'error']` for each rule. */
const errors = (prefix: string, rules: ReadonlyArray<string>): Rules =>
  Object.fromEntries(rules.map((rule) => [`${prefix}${rule}`, 'error']))

/** Correctness rules and conventions for JavaScript and TypeScript alike. */
const CORE = [
  'curly',
  'eqeqeq',
  'for-direction',
  'no-async-promise-executor',
  'no-case-declarations',
  'no-compare-neg-zero',
  'no-cond-assign',
  'no-constant-binary-expression',
  'no-constant-condition',
  'no-control-regex',
  'no-debugger',
  'no-delete-var',
  'no-dupe-else-if',
  'no-duplicate-case',
  'no-empty',
  'no-empty-pattern',
  'no-empty-static-block',
  'no-eval',
  'no-ex-assign',
  'no-extra-boolean-cast',
  'no-fallthrough',
  'no-global-assign',
  'no-invalid-regexp',
  'no-irregular-whitespace',
  'no-loss-of-precision',
  'no-misleading-character-class',
  'no-new-func',
  'no-nonoctal-decimal-escape',
  'no-prototype-builtins',
  'no-regex-spaces',
  'no-self-assign',
  'no-self-compare',
  'no-shadow-restricted-names',
  'no-sparse-arrays',
  'no-template-curly-in-string',
  'no-unassigned-vars',
  'no-unexpected-multiline',
  'no-unreachable-loop',
  'no-unsafe-finally',
  'no-unsafe-optional-chaining',
  'no-unused-labels',
  'no-unused-private-class-members',
  'no-unused-vars',
  'no-useless-assignment',
  'no-useless-catch',
  'no-useless-escape',
  'no-var',
  'prefer-arrow-callback',
  'prefer-const',
  'preserve-caught-error',
  'require-yield',
  'use-isnan',
  'valid-typeof',
]

/** Rules TypeScript's compiler already enforces, so JavaScript alone needs them. */
const JAVASCRIPT_ONLY = [
  'constructor-super',
  'getter-return',
  'no-class-assign',
  'no-const-assign',
  'no-dupe-class-members',
  'no-dupe-keys',
  'no-func-assign',
  'no-implied-eval',
  'no-import-assign',
  'no-new-native-nonconstructor',
  'no-obj-calls',
  'no-redeclare',
  'no-setter-return',
  'no-this-before-super',
  'no-undef',
  'no-unreachable',
  'no-unsafe-negation',
  'no-with',
]

/** Core rules typescript-eslint's strict preset turns on for TypeScript. */
const TYPESCRIPT_CORE = [
  'no-array-constructor',
  'no-unused-expressions',
  'no-useless-constructor',
  'prefer-rest-params',
  'prefer-spread',
]

/** typescript-eslint's strict type-checked preset, plus stricter additions. */
const TYPESCRIPT_RULES = [
  'array-type',
  'await-thenable',
  'ban-ts-comment',
  'consistent-type-assertions',
  'consistent-type-imports',
  'method-signature-style',
  'no-array-delete',
  'no-base-to-string',
  'no-confusing-void-expression',
  'no-deprecated',
  'no-duplicate-enum-values',
  'no-duplicate-type-constituents',
  'no-dynamic-delete',
  'no-empty-object-type',
  'no-explicit-any',
  'no-extra-non-null-assertion',
  'no-extraneous-class',
  'no-floating-promises',
  'no-for-in-array',
  'no-generated-empty-object-type',
  'no-implied-eval',
  'no-import-type-side-effects',
  'no-invalid-void-type',
  'no-meaningless-void-operator',
  'no-misused-new',
  'no-misused-promises',
  'no-misused-spread',
  'no-mixed-enums',
  'no-namespace',
  'no-non-null-asserted-nullish-coalescing',
  'no-non-null-asserted-optional-chain',
  'no-redundant-type-constituents',
  'no-require-imports',
  'no-this-alias',
  'no-unnecessary-boolean-literal-compare',
  'no-unnecessary-condition',
  'no-unnecessary-template-expression',
  'no-unnecessary-type-arguments',
  'no-unnecessary-type-assertion',
  'no-unnecessary-type-constraint',
  'no-unnecessary-type-conversion',
  'no-unnecessary-type-parameters',
  'no-unsafe-argument',
  'no-unsafe-assignment',
  'no-unsafe-call',
  'no-unsafe-declaration-merging',
  'no-unsafe-enum-assignment',
  'no-unsafe-enum-comparison',
  'no-unsafe-function-type',
  'no-unsafe-member-access',
  'no-unsafe-return',
  'no-unsafe-type-assertion',
  'no-unsafe-unary-minus',
  'no-useless-default-assignment',
  'no-wrapper-object-types',
  'only-throw-error',
  'prefer-as-const',
  'prefer-literal-enum-member',
  'prefer-namespace-keyword',
  'prefer-nullish-coalescing',
  'prefer-optional-chain',
  'prefer-promise-reject-errors',
  'prefer-readonly',
  'prefer-reduce-type-parameter',
  'prefer-return-this-type',
  'related-getter-setter-pairs',
  'require-array-sort-compare',
  'require-await',
  'restrict-plus-operands',
  'restrict-template-expressions',
  'return-await',
  'strict-boolean-expressions',
  'switch-exhaustiveness-check',
  'triple-slash-reference',
  'unbound-method',
  'unified-signatures',
  'use-unknown-in-catch-callback-variable',
]

/** oxlint's own `eslint-plugin-unicorn` rules that catch defects; none of the style rules. */
const UNICORN = [
  'error-message',
  'no-accessor-recursion',
  'no-array-fill-with-reference-type',
  'no-await-in-promise-methods',
  'no-instanceof-builtins',
  'no-invalid-remove-event-listener',
  'no-negation-in-equality-check',
  'no-thenable',
  'no-unnecessary-await',
  'no-useless-spread',
  'prefer-node-protocol',
  'throw-new-error',
]

/**
 * Defect-finding `eslint-plugin-unicorn` rules oxlint lacks, run as a JS plugin: event timing,
 * promises, discarded results and unsafe sinks.
 */
const UNICORN_PLUGIN = [
  'no-async-promise-finally',
  'no-invalid-url-protocol-comparison',
  'no-late-current-target-access',
  'no-late-event-control',
  'no-loop-iterable-mutation',
  'no-mismatched-map-key',
  'no-multiple-promise-resolver-calls',
  'no-prevent-default-in-passive-listener',
  'no-unsafe-dom-html',
  'no-unsafe-promise-all-settled-values',
  'no-unused-builtin-method-return',
]

/** `eslint-plugin-regexp`'s ReDoS and misleading-match rules, run as a JS plugin. */
const REGEXP_PLUGIN = [
  'no-contradiction-with-assertion',
  'no-dupe-disjunctions',
  'no-empty-alternative',
  'no-invisible-character',
  'no-lazy-ends',
  'no-misleading-capturing-group',
  'no-misleading-unicode-character',
  'no-missing-g-flag',
  'no-obscure-range',
  'no-super-linear-backtracking',
]

const VITEST = [
  'hoisted-apis-on-top',
  'no-commented-out-tests',
  'no-disabled-tests',
  'no-focused-tests',
  'no-identical-title',
  'no-interpolation-in-snapshots',
  'no-mocks-import',
  'no-standalone-expect',
  'no-unneeded-async-expect-function',
  'prefer-called-exactly-once-with',
  'require-local-test-context-for-concurrent-snapshots',
  'require-to-throw-message',
  'valid-describe-callback',
  'valid-expect',
  'valid-expect-in-promise',
  'warn-todo',
]

/**
 * React and React Compiler rules. `immutability` is left out: it flags the cancel flag
 * (`let live = true`, cleared on cleanup), and a build with `reactCompilerGuard()` fails on what
 * the compiler really cannot handle.
 */
const REACT = [
  'error-boundaries',
  'exhaustive-deps',
  'globals',
  'incompatible-library',
  'jsx-key',
  'jsx-no-comment-textnodes',
  'jsx-no-script-url',
  'no-children-prop',
  'no-danger',
  'no-danger-with-children',
  'no-did-mount-set-state',
  'no-did-update-set-state',
  'no-direct-mutation-state',
  'no-find-dom-node',
  'no-namespace',
  'no-render-return-value',
  'no-unsafe',
  'no-will-update-set-state',
  'prefer-function-component',
  'preserve-manual-memoization',
  'purity',
  'refs',
  'rules-of-hooks',
  'set-state-in-effect',
  'set-state-in-render',
  'static-components',
  'unsupported-syntax',
  'use-memo',
  'void-dom-elements-no-children',
  'void-use-memo',
]

/** `@eslint-react` rules oxlint lacks, run as a JS plugin: leaks, typos and deprecated APIs. */
const REACT_PLUGIN = [
  'dom-no-flush-sync',
  'dom-no-unsafe-iframe-sandbox',
  'jsx-no-leaked-dollar',
  'jsx-no-leaked-semicolon',
  'no-context-provider',
  'no-duplicate-key',
  'no-forward-ref',
  'no-unnecessary-use-prefix',
  'web-api-no-leaked-event-listener',
  'web-api-no-leaked-fetch',
  'web-api-no-leaked-intersection-observer',
  'web-api-no-leaked-interval',
  'web-api-no-leaked-resize-observer',
  'web-api-no-leaked-timeout',
]

const ACCESSIBILITY = [
  'alt-text',
  'anchor-has-content',
  'anchor-is-valid',
  'aria-activedescendant-has-tabindex',
  'aria-props',
  'aria-proptypes',
  'aria-role',
  'aria-unsupported-elements',
  'autocomplete-valid',
  'click-events-have-key-events',
  'heading-has-content',
  'html-has-lang',
  'iframe-has-title',
  'img-redundant-alt',
  'interactive-supports-focus',
  'label-has-associated-control',
  'lang',
  'media-has-caption',
  'mouse-events-have-key-events',
  'no-access-key',
  'no-aria-hidden-on-focusable',
  'no-autofocus',
  'no-distracting-elements',
  'no-interactive-element-to-noninteractive-role',
  'no-noninteractive-element-interactions',
  'no-noninteractive-element-to-interactive-role',
  'no-noninteractive-tabindex',
  'no-redundant-roles',
  'no-static-element-interactions',
  'role-has-required-aria-props',
  'role-supports-aria-props',
  'scope',
  'tabindex-no-positive',
]

/** Stricter options than a rule's default, for the rules that have them. */
const OPTIONS: Rules = {
  curly: ['error', 'all'],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-constant-condition': ['error', { checkLoops: 'allExceptWhileTrue' }],
  'no-fallthrough': ['error', { reportUnusedFallthroughComment: true }],
  'no-irregular-whitespace': ['error', { skipStrings: true }],
  'no-unsafe-optional-chaining': ['error', { disallowArithmeticOperators: true }],
  'no-unused-vars': [
    'error',
    {
      args: 'all',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      ignoreRestSiblings: true,
      // A `_` name that is read is not unused; the prefix must not hide live code.
      reportUsedIgnorePattern: true,
    },
  ],
  // A named function expression keeps a component's name through memo.
  'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
  'preserve-caught-error': ['error', { requireCatchParameter: true }],
  'use-isnan': ['error', { enforceForIndexOf: true }],
  'valid-typeof': ['error', { requireStringLiterals: true }],
}

const TYPESCRIPT_OPTIONS: Rules = {
  'typescript/array-type': ['error', { default: 'generic', readonly: 'generic' }],
  // Shipped code fixes a type instead of expecting an error; tests may assert one.
  'typescript/ban-ts-comment': [
    'error',
    { 'ts-check': false, 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true },
  ],
  // Assertions only as `as`, never on a literal (use `satisfies` or an annotation).
  'typescript/consistent-type-assertions': [
    'error',
    {
      assertionStyle: 'as',
      objectLiteralTypeAssertions: 'never',
      arrayLiteralTypeAssertions: 'never',
    },
  ],
  'typescript/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
  // Method syntax makes parameters bivariant, a hole strictFunctionTypes leaves open.
  'typescript/method-signature-style': ['error', 'property'],
  'typescript/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
  'typescript/no-floating-promises': ['error', { checkThenables: true }],
  // A `while (true)` worker loop states its intent; other constant conditions stay errors.
  'typescript/no-unnecessary-condition': [
    'error',
    { allowConstantLoopConditions: 'only-allowed-literals' },
  ],
  // React Router redirects and responses and Suspense promises are thrown on purpose.
  'typescript/only-throw-error': [
    'error',
    {
      allow: [
        { from: 'lib', name: ['Response', 'Promise'] },
        { from: 'package', name: 'DataWithResponseInit', package: 'react-router' },
      ],
      allowRethrowing: true,
      allowThrowingAny: false,
      allowThrowingUnknown: false,
    },
  ],
  'typescript/restrict-plus-operands': [
    'error',
    {
      allowAny: false,
      allowBoolean: false,
      allowNullish: false,
      allowNumberAndString: false,
      allowRegExp: false,
    },
  ],
  'typescript/restrict-template-expressions': [
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
  'typescript/return-await': ['error', 'error-handling-correctness-only'],
  // Strings may use truthiness; numbers must be compared explicitly.
  'typescript/strict-boolean-expressions': [
    'error',
    {
      allowString: true,
      allowNullableString: true,
      allowNumber: false,
      allowNullableObject: true,
      allowNullableBoolean: true,
    },
  ],
  // A `default:` must not absorb a union member added later.
  'typescript/switch-exhaustiveness-check': [
    'error',
    {
      allowDefaultCaseForExhaustiveSwitch: false,
      considerDefaultExhaustiveForUnions: false,
      requireDefaultForNonUnion: true,
    },
  ],
}

/** `@toolpath/ui` is the one home for styling; every other package's `src/` ships logic. */
const STYLING_RULES: Rules = {
  'no-restricted-imports': [
    'error',
    { patterns: [{ group: [...STYLING_IMPORTS], message: STYLING_IMPORT_MESSAGE }] },
  ],
  'toolpath/no-styling-attributes': 'error',
}

/** A package's entry file, so the JS plugins resolve from here and not from the consumer. */
const pluginPath = (specifier: string): string => fileURLToPath(import.meta.resolve(specifier))

/**
 * The shared oxlint config: correctness rules and conventions everywhere, typescript-eslint's
 * strict type-checked rules for TypeScript, Vitest rules for tests, and with `react`, the Hooks
 * and React Compiler, React and accessibility rules. Every rule is an error or off, and a disable
 * comment that suppresses nothing is an error.
 *
 * ```ts
 * // oxlint.config.ts
 * import { createOxlintConfig } from '@toolpath/dev-config/oxlint'
 *
 * export default createOxlintConfig({ react: true })
 * ```
 */
export const createOxlintConfig = ({
  react = false,
  forbidStyling = false,
  ignores = [],
}: OxlintConfigOptions = {}): OxlintConfig => ({
  categories: {
    correctness: 'off',
    nursery: 'off',
    pedantic: 'off',
    perf: 'off',
    restriction: 'off',
    style: 'off',
    suspicious: 'off',
  },
  env: { browser: true, es2024: true, node: true },
  ignorePatterns: [...BUILD_OUTPUT, ...ignores],
  jsPlugins: [
    { name: 'import-x-js', specifier: pluginPath('eslint-plugin-import-x') },
    { name: 'regexp', specifier: pluginPath('eslint-plugin-regexp') },
    { name: 'toolpath', specifier: fileURLToPath(new URL('oxlint-plugin.js', import.meta.url)) },
    // oxlint reserves the names of the plugins it reimplements, so these two are aliased.
    { name: 'unicorn-js', specifier: pluginPath('eslint-plugin-unicorn') },
    ...(react
      ? [{ name: 'eslint-react', specifier: pluginPath('@eslint-react/eslint-plugin') }]
      : []),
  ],
  options: { reportUnusedDisableDirectives: 'error', typeAware: true },
  plugins: [
    'import',
    'typescript',
    'unicorn',
    'vitest',
    ...(react ? (['jsx-a11y', 'react'] as const) : []),
  ],
  rules: {
    ...errors('', CORE),
    ...OPTIONS,
    ...errors('unicorn/', UNICORN),
    ...errors('unicorn-js/', UNICORN_PLUGIN),
    ...errors('regexp/', REGEXP_PLUGIN),
    'import/no-cycle': ['error', { ignoreExternal: true }],
    'import/no-duplicates': 'error',
    'import/no-self-import': 'error',
    'import-x-js/no-extraneous-dependencies': [
      'error',
      { devDependencies: DEVELOPMENT_FILES, optionalDependencies: false },
    ],
    // A relative import into another package bypasses its declared exports.
    'toolpath/no-relative-packages': 'error',
    ...(react
      ? {
          ...errors('react/', REACT),
          'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
          ...errors('eslint-react/', REACT_PLUGIN),
        }
      : {}),
  },
  overrides: [
    { files: JAVASCRIPT, rules: errors('', JAVASCRIPT_ONLY) },
    {
      files: TYPESCRIPT,
      rules: {
        ...errors('', TYPESCRIPT_CORE),
        ...errors('typescript/', TYPESCRIPT_RULES),
        ...TYPESCRIPT_OPTIONS,
        'no-unused-expressions': [
          'error',
          { allowShortCircuit: false, allowTaggedTemplates: false, allowTernary: false },
        ],
        // `noUncheckedIndexedAccess` types every `values[i]` as possibly undefined, and a loop
        // bound usually proves it is not. Nothing proves a lookup, a field or a call.
        'toolpath/no-non-null-outside-index': 'error',
      },
    },
    ...(react
      ? [
          { files: JSX, rules: errors('jsx-a11y/', ACCESSIBILITY) },
          {
            files: JSX,
            excludeFiles: DEVELOPMENT_FILES,
            rules: { 'react/button-has-type': 'error' as const },
          },
        ]
      : []),
    ...(forbidStyling ? [{ files: [...STYLING_SOURCE], rules: STYLING_RULES }] : []),
    {
      // A wrong `!` or cast in a test fails the test loudly, so tests may use them to reach into
      // fixtures; the async and `no-unsafe-*` rules stay on. Mock classes and spreads of
      // class-instance fixtures are normal here.
      files: TESTS,
      rules: {
        ...errors('vitest/', VITEST),
        'vitest/valid-expect': ['error', { alwaysAwait: true, maxArgs: 2 }],
        'typescript/ban-ts-comment': ['error', { minimumDescriptionLength: 10 }],
        'typescript/consistent-type-assertions': 'off',
        'typescript/no-extraneous-class': 'off',
        'typescript/no-misused-spread': 'off',
        'typescript/no-unsafe-type-assertion': 'off',
        'typescript/require-await': 'off',
        'typescript/unbound-method': 'off',
        'toolpath/no-non-null-outside-index': 'off',
      },
    },
  ],
})
