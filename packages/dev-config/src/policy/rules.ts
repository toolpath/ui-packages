/**
 * The effective rule map, written out rule by rule. Nothing here spreads a
 * plugin's preset: a new rule in a future plugin release changes nothing until a
 * dev-config release adds it here. `tests/policy.test.ts` compares each group
 * against the pinned plugins' rule metadata so a renamed or deprecated rule fails.
 *
 * Every entry is `error` or `off`: lint runs with zero warnings, so a warning
 * would only be an error that reads as optional.
 */

export type RuleEntry = 'error' | 'off' | readonly ['error', ...Array<unknown>]
export type RuleMap = Readonly<Record<string, RuleEntry>>

/** ESLint core correctness rules for every maintained JS/TS file. */
export const javascriptRules: RuleMap = {
  'constructor-super': 'error',
  'for-direction': 'error',
  'getter-return': 'error',
  'no-async-promise-executor': 'error',
  'no-case-declarations': 'error',
  'no-class-assign': 'error',
  'no-compare-neg-zero': 'error',
  'no-cond-assign': 'error',
  'no-const-assign': 'error',
  'no-constant-binary-expression': 'error',
  'no-constant-condition': 'error',
  'no-control-regex': 'error',
  'no-debugger': 'error',
  'no-delete-var': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-dupe-else-if': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-empty': 'error',
  'no-empty-character-class': 'error',
  'no-empty-pattern': 'error',
  'no-empty-static-block': 'error',
  'no-ex-assign': 'error',
  'no-extra-boolean-cast': 'error',
  'no-fallthrough': 'error',
  'no-func-assign': 'error',
  'no-global-assign': 'error',
  'no-import-assign': 'error',
  'no-invalid-regexp': 'error',
  'no-irregular-whitespace': 'error',
  'no-loss-of-precision': 'error',
  'no-misleading-character-class': 'error',
  'no-new-native-nonconstructor': 'error',
  'no-nonoctal-decimal-escape': 'error',
  'no-obj-calls': 'error',
  'no-octal': 'error',
  'no-prototype-builtins': 'error',
  'no-redeclare': 'error',
  'no-regex-spaces': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-setter-return': 'error',
  'no-shadow-restricted-names': 'error',
  'no-sparse-arrays': 'error',
  'no-this-before-super': 'error',
  'no-unassigned-vars': 'error',
  'no-undef': 'error',
  'no-unexpected-multiline': 'error',
  'no-unreachable': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-unused-labels': 'error',
  'no-unused-private-class-members': 'error',
  'no-useless-assignment': 'error',
  'no-useless-backreference': 'error',
  'no-useless-catch': 'error',
  'no-useless-escape': 'error',
  'no-with': 'error',
  'preserve-caught-error': 'error',
  'require-yield': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'error',
  'prefer-const': 'error',
  'prefer-rest-params': 'error',
  'prefer-spread': 'error',
  curly: ['error', 'all'],
}

/**
 * Core rules TypeScript's checker already enforces in a strict program, or that
 * a typed equivalent below replaces. Turning them off avoids two messages for
 * one defect.
 */
export const typescriptCheckedCoreRules: RuleMap = {
  'constructor-super': 'off',
  'getter-return': 'off',
  'no-class-assign': 'off',
  'no-const-assign': 'off',
  'no-dupe-args': 'off',
  'no-dupe-class-members': 'off',
  'no-dupe-keys': 'off',
  'no-func-assign': 'off',
  'no-import-assign': 'off',
  'no-new-native-nonconstructor': 'off',
  'no-obj-calls': 'off',
  'no-redeclare': 'off',
  'no-setter-return': 'off',
  'no-this-before-super': 'off',
  'no-undef': 'off',
  'no-unreachable': 'off',
  'no-unsafe-negation': 'off',
  'no-with': 'off',
  'no-array-constructor': 'off',
  'no-implied-eval': 'off',
  'no-unused-expressions': 'off',
  'no-unused-vars': 'off',
  'no-useless-constructor': 'off',
  'no-throw-literal': 'off',
  'prefer-promise-reject-errors': 'off',
  'require-await': 'off',
}

/** typescript-eslint's strict type-checked rules, plus the stylistic rules the standard names. */
export const typescriptRules: RuleMap = {
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': true,
      'ts-nocheck': true,
      'ts-check': false,
      minimumDescriptionLength: 10,
    },
  ],
  '@typescript-eslint/no-array-constructor': 'error',
  '@typescript-eslint/no-array-delete': 'error',
  '@typescript-eslint/no-base-to-string': 'error',
  '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
  '@typescript-eslint/no-deprecated': 'error',
  '@typescript-eslint/no-duplicate-enum-values': 'error',
  '@typescript-eslint/no-duplicate-type-constituents': 'error',
  '@typescript-eslint/no-dynamic-delete': 'error',
  '@typescript-eslint/no-empty-object-type': 'error',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-extra-non-null-assertion': 'error',
  '@typescript-eslint/no-extraneous-class': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-for-in-array': 'error',
  '@typescript-eslint/no-implied-eval': 'error',
  '@typescript-eslint/no-invalid-void-type': 'error',
  '@typescript-eslint/no-meaningless-void-operator': 'error',
  '@typescript-eslint/no-misused-new': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/no-misused-spread': 'error',
  '@typescript-eslint/no-mixed-enums': 'error',
  '@typescript-eslint/no-namespace': 'error',
  '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
  '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/no-redundant-type-constituents': 'error',
  '@typescript-eslint/no-require-imports': 'error',
  '@typescript-eslint/no-this-alias': 'error',
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/no-unnecessary-template-expression': 'error',
  '@typescript-eslint/no-unnecessary-type-arguments': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/no-unnecessary-type-constraint': 'error',
  '@typescript-eslint/no-unnecessary-type-conversion': 'error',
  '@typescript-eslint/no-unnecessary-type-parameters': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-declaration-merging': 'error',
  '@typescript-eslint/no-unsafe-enum-comparison': 'error',
  '@typescript-eslint/no-unsafe-function-type': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-unsafe-unary-minus': 'error',
  '@typescript-eslint/no-unused-expressions': 'error',
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
  '@typescript-eslint/no-useless-constructor': 'error',
  '@typescript-eslint/no-useless-default-assignment': 'error',
  '@typescript-eslint/no-wrapper-object-types': 'error',
  '@typescript-eslint/only-throw-error': 'error',
  '@typescript-eslint/prefer-as-const': 'error',
  '@typescript-eslint/prefer-literal-enum-member': 'error',
  '@typescript-eslint/prefer-namespace-keyword': 'error',
  '@typescript-eslint/prefer-promise-reject-errors': 'error',
  '@typescript-eslint/prefer-reduce-type-parameter': 'error',
  '@typescript-eslint/prefer-return-this-type': 'error',
  '@typescript-eslint/related-getter-setter-pairs': 'error',
  '@typescript-eslint/require-await': 'error',
  '@typescript-eslint/restrict-plus-operands': [
    'error',
    {
      allowAny: false,
      allowBoolean: false,
      allowNullish: false,
      allowNumberAndString: false,
      allowRegExp: false,
    },
  ],
  '@typescript-eslint/restrict-template-expressions': [
    'error',
    {
      allowAny: false,
      allowBoolean: false,
      allowNever: false,
      allowNullish: false,
      allowNumber: true,
      allowRegExp: false,
    },
  ],
  '@typescript-eslint/return-await': ['error', 'error-handling-correctness-only'],
  '@typescript-eslint/triple-slash-reference': 'error',
  '@typescript-eslint/unbound-method': 'error',
  '@typescript-eslint/unified-signatures': 'error',
  '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': [
    'error',
    {
      allowDefaultCaseForExhaustiveSwitch: true,
      considerDefaultExhaustiveForUnions: true,
      requireDefaultForNonUnion: false,
    },
  ],
}

/** Rules about TypeScript syntax itself, for `.ts`/`.tsx`/`.mts`/`.cts` files only. */
export const typescriptSyntaxRules: RuleMap = {
  '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: true },
  ],
  '@typescript-eslint/consistent-type-exports': 'error',
  '@typescript-eslint/no-import-type-side-effects': 'error',
}

/** CommonJS files (`.cjs`, `.cts`) keep their module semantics, so `require` is how they import. */
export const commonJsRules: RuleMap = {
  '@typescript-eslint/no-require-imports': 'off',
}

/** Package-owned generic rules. */
export const toolpathRules: RuleMap = {
  'toolpath/prefer-const-arrow': 'error',
  'toolpath/no-blanket-quality-disable': 'error',
}

/** Hooks and React Compiler diagnostics from the pinned `eslint-plugin-react-hooks`. */
export const reactHooksRules: RuleMap = {
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'error',
  'react-hooks/static-components': 'error',
  'react-hooks/use-memo': 'error',
  'react-hooks/void-use-memo': 'error',
  'react-hooks/preserve-manual-memoization': 'error',
  'react-hooks/incompatible-library': 'error',
  'react-hooks/immutability': 'error',
  'react-hooks/globals': 'error',
  'react-hooks/refs': 'error',
  'react-hooks/set-state-in-effect': 'error',
  'react-hooks/error-boundaries': 'error',
  'react-hooks/purity': 'error',
  'react-hooks/set-state-in-render': 'error',
  'react-hooks/unsupported-syntax': 'error',
  'react-hooks/config': 'error',
  'react-hooks/gating': 'error',
}

/**
 * `@eslint-react` rules that the Hooks plugin does not already diagnose: keys,
 * context values, leaked conditional rendering, legacy APIs. Its own Hooks,
 * purity, and static-component rules are omitted as duplicates.
 */
export const reactQualityRules: RuleMap = {
  '@eslint-react/no-missing-key': 'error',
  '@eslint-react/no-duplicate-key': 'error',
  '@eslint-react/no-array-index-key': 'error',
  '@eslint-react/no-unstable-context-value': 'error',
  '@eslint-react/no-nested-lazy-component-declarations': 'error',
  '@eslint-react/no-leaked-conditional-rendering': 'error',
  '@eslint-react/no-direct-mutation-state': 'error',
  '@eslint-react/no-access-state-in-setstate': 'error',
  '@eslint-react/no-component-will-mount': 'error',
  '@eslint-react/no-component-will-receive-props': 'error',
  '@eslint-react/no-component-will-update': 'error',
  '@eslint-react/no-unsafe-component-will-mount': 'error',
  '@eslint-react/no-unsafe-component-will-receive-props': 'error',
  '@eslint-react/no-unsafe-component-will-update': 'error',
  '@eslint-react/jsx-no-key-after-spread': 'error',
  '@eslint-react/jsx-no-children-prop-with-children': 'error',
  '@eslint-react/jsx-no-comment-textnodes': 'error',
  'toolpath/require-compiler-optout-reason': 'error',
}

/** Resource cleanup for timers and requests, which exist in every renderer. */
export const reactResourceRules: RuleMap = {
  '@eslint-react/web-api-no-leaked-interval': 'error',
  '@eslint-react/web-api-no-leaked-timeout': 'error',
  '@eslint-react/web-api-no-leaked-fetch': 'error',
}

/** DOM-only React rules: listeners, observers, and DOM APIs. */
export const reactDomRules: RuleMap = {
  '@eslint-react/web-api-no-leaked-event-listener': 'error',
  '@eslint-react/web-api-no-leaked-resize-observer': 'error',
  '@eslint-react/web-api-no-leaked-intersection-observer': 'error',
  '@eslint-react/dom-no-dangerously-set-innerhtml-with-children': 'error',
  '@eslint-react/dom-no-find-dom-node': 'error',
  '@eslint-react/dom-no-hydrate': 'error',
  '@eslint-react/dom-no-render': 'error',
  '@eslint-react/dom-no-render-return-value': 'error',
  '@eslint-react/dom-no-script-url': 'error',
  '@eslint-react/dom-no-unsafe-iframe-sandbox': 'error',
  '@eslint-react/dom-no-unsafe-target-blank': 'error',
  '@eslint-react/dom-no-void-elements-with-children': 'error',
  '@eslint-react/dom-no-missing-button-type': 'error',
}

/** DOM accessibility from `eslint-plugin-jsx-a11y-x`'s recommended set. */
export const accessibilityRules: RuleMap = {
  'jsx-a11y-x/alt-text': 'error',
  'jsx-a11y-x/anchor-has-content': 'error',
  'jsx-a11y-x/anchor-is-valid': 'error',
  'jsx-a11y-x/aria-activedescendant-has-tabindex': 'error',
  'jsx-a11y-x/aria-props': 'error',
  'jsx-a11y-x/aria-proptypes': 'error',
  'jsx-a11y-x/aria-role': 'error',
  'jsx-a11y-x/aria-unsupported-elements': 'error',
  'jsx-a11y-x/autocomplete-valid': 'error',
  'jsx-a11y-x/click-events-have-key-events': 'error',
  'jsx-a11y-x/heading-has-content': 'error',
  'jsx-a11y-x/html-has-lang': 'error',
  'jsx-a11y-x/iframe-has-title': 'error',
  'jsx-a11y-x/img-redundant-alt': 'error',
  'jsx-a11y-x/interactive-supports-focus': [
    'error',
    { tabbable: ['button', 'checkbox', 'link', 'searchbox', 'spinbutton', 'switch', 'textbox'] },
  ],
  'jsx-a11y-x/label-has-associated-control': 'error',
  'jsx-a11y-x/media-has-caption': 'error',
  'jsx-a11y-x/mouse-events-have-key-events': 'error',
  'jsx-a11y-x/no-access-key': 'error',
  'jsx-a11y-x/no-autofocus': 'error',
  'jsx-a11y-x/no-distracting-elements': 'error',
  'jsx-a11y-x/no-interactive-element-to-noninteractive-role': [
    'error',
    { tr: ['none', 'presentation'], canvas: ['img'] },
  ],
  'jsx-a11y-x/no-noninteractive-element-interactions': [
    'error',
    {
      handlers: [
        'onClick',
        'onError',
        'onLoad',
        'onMouseDown',
        'onMouseUp',
        'onKeyPress',
        'onKeyDown',
        'onKeyUp',
      ],
      alert: ['onKeyUp', 'onKeyDown', 'onKeyPress'],
      body: ['onError', 'onLoad'],
      dialog: ['onKeyUp', 'onKeyDown', 'onKeyPress'],
      iframe: ['onError', 'onLoad'],
      img: ['onError', 'onLoad'],
    },
  ],
  'jsx-a11y-x/no-noninteractive-element-to-interactive-role': [
    'error',
    {
      ul: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
      ol: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
      li: ['menuitem', 'menuitemradio', 'menuitemcheckbox', 'option', 'row', 'tab', 'treeitem'],
      table: ['grid'],
      td: ['gridcell'],
      fieldset: ['radiogroup', 'presentation'],
    },
  ],
  'jsx-a11y-x/no-noninteractive-tabindex': [
    'error',
    { tags: [], roles: ['tabpanel'], allowExpressionValues: true },
  ],
  'jsx-a11y-x/no-redundant-roles': 'error',
  'jsx-a11y-x/no-static-element-interactions': [
    'error',
    {
      allowExpressionValues: true,
      handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'],
    },
  ],
  'jsx-a11y-x/role-has-required-aria-props': 'error',
  'jsx-a11y-x/role-supports-aria-props': 'error',
  'jsx-a11y-x/scope': 'error',
  'jsx-a11y-x/tabindex-no-positive': 'error',
}

/** Vitest test files. `vitest/unbound-method` replaces the typed rule so `expect(mock.method)` is understood. */
export const vitestRules: RuleMap = {
  'vitest/expect-expect': 'error',
  'vitest/no-commented-out-tests': 'error',
  'vitest/no-conditional-expect': 'error',
  'vitest/no-disabled-tests': 'error',
  'vitest/no-focused-tests': 'error',
  'vitest/no-identical-title': 'error',
  'vitest/no-import-node-test': 'error',
  'vitest/no-interpolation-in-snapshots': 'error',
  'vitest/no-mocks-import': 'error',
  'vitest/no-standalone-expect': 'error',
  'vitest/no-unneeded-async-expect-function': 'error',
  'vitest/require-local-test-context-for-concurrent-snapshots': 'error',
  'vitest/valid-describe-callback': 'error',
  // Vitest takes an assertion message as a second argument.
  'vitest/valid-expect': ['error', { alwaysAwait: true, maxArgs: 2 }],
  'vitest/valid-expect-in-promise': 'error',
  'vitest/valid-title': 'error',
  'vitest/require-awaited-expect-poll': 'error',
  '@typescript-eslint/unbound-method': 'off',
  'vitest/unbound-method': 'error',
}

/** Jest Expo test files. */
export const jestRules: RuleMap = {
  'jest/expect-expect': 'error',
  'jest/no-alias-methods': 'error',
  'jest/no-commented-out-tests': 'error',
  'jest/no-conditional-expect': 'error',
  'jest/no-deprecated-functions': 'error',
  'jest/no-disabled-tests': 'error',
  'jest/no-done-callback': 'error',
  'jest/no-export': 'error',
  'jest/no-focused-tests': 'error',
  'jest/no-identical-title': 'error',
  'jest/no-interpolation-in-snapshots': 'error',
  'jest/no-jasmine-globals': 'error',
  'jest/no-mocks-import': 'error',
  'jest/no-standalone-expect': 'error',
  'jest/no-test-prefixes': 'error',
  'jest/valid-describe-callback': 'error',
  'jest/valid-expect': ['error', { alwaysAwait: true }],
  'jest/valid-expect-in-promise': 'error',
  'jest/valid-title': 'error',
  '@typescript-eslint/unbound-method': 'off',
  'jest/unbound-method': 'error',
}

/**
 * Playwright test files: correctness and flake sources (sleeps, focused or
 * skipped tests, unawaited actions). Its layout and ordering preferences are
 * left out; Prettier owns layout.
 */
export const playwrightRules: RuleMap = {
  'playwright/expect-expect': 'error',
  'playwright/missing-playwright-await': 'error',
  'playwright/no-conditional-expect': 'error',
  'playwright/no-duplicate-hooks': 'error',
  'playwright/no-element-handle': 'error',
  'playwright/no-eval': 'error',
  'playwright/no-focused-test': 'error',
  'playwright/no-force-option': 'error',
  'playwright/no-identical-title': 'error',
  'playwright/no-nested-step': 'error',
  'playwright/no-networkidle': 'error',
  'playwright/no-page-pause': 'error',
  'playwright/no-skipped-test': 'error',
  'playwright/no-standalone-expect': 'error',
  'playwright/no-unnecessary-assertions': 'error',
  'playwright/no-unsafe-references': 'error',
  'playwright/no-unused-locators': 'error',
  'playwright/no-useless-await': 'error',
  'playwright/no-useless-not': 'error',
  'playwright/no-wait-for-navigation': 'error',
  'playwright/no-wait-for-selector': 'error',
  'playwright/no-wait-for-timeout': 'error',
  'playwright/prefer-web-first-assertions': 'error',
  'playwright/valid-describe-callback': 'error',
  'playwright/valid-expect': 'error',
  'playwright/valid-expect-in-promise': 'error',
  'playwright/valid-test-tags': 'error',
  'playwright/valid-title': 'error',
}

/** Testing Library usage in DOM component tests. */
export const testingLibraryRules: RuleMap = {
  'testing-library/await-async-events': ['error', { eventModule: 'userEvent' }],
  'testing-library/await-async-queries': 'error',
  'testing-library/await-async-utils': 'error',
  'testing-library/no-await-sync-events': ['error', { eventModules: ['fire-event'] }],
  'testing-library/no-await-sync-queries': 'error',
  'testing-library/no-container': 'error',
  'testing-library/no-debugging-utils': 'error',
  'testing-library/no-dom-import': ['error', 'react'],
  'testing-library/no-global-regexp-flag-in-query': 'error',
  'testing-library/no-manual-cleanup': 'error',
  'testing-library/no-node-access': 'error',
  'testing-library/no-promise-in-fire-event': 'error',
  'testing-library/no-render-in-lifecycle': 'error',
  'testing-library/no-unnecessary-act': 'error',
  'testing-library/no-wait-for-multiple-assertions': 'error',
  'testing-library/no-wait-for-side-effects': 'error',
  'testing-library/no-wait-for-snapshot': 'error',
  'testing-library/prefer-find-by': 'error',
  'testing-library/prefer-presence-queries': 'error',
  'testing-library/prefer-query-by-disappearance': 'error',
  'testing-library/prefer-screen-queries': 'error',
}

/** Engine integration boundary rules, active only with the `engine` profile. */
export const engineRules: RuleMap = {
  'toolpath-engine/no-direct-engine-http': 'error',
}

export interface PolicyGroup {
  id: string
  title: string
  appliesTo: string
  rationale: string
  rules: RuleMap
}

/** The rationale table published in `docs/policy.md`, in the order configs are composed. */
export const POLICY_GROUPS: ReadonlyArray<PolicyGroup> = [
  {
    id: 'javascript',
    title: 'Core correctness',
    appliesTo: 'every maintained JS/TS file',
    rationale:
      'Real defects (unreachable code, invalid regexes, self-comparison) plus `curly`, `const`, and arrow callbacks.',
    rules: javascriptRules,
  },
  {
    id: 'typescript-checked',
    title: 'Checker-owned core rules',
    appliesTo: 'every file in a TypeScript program',
    rationale: 'TypeScript already reports these in strict programs; one message per defect.',
    rules: typescriptCheckedCoreRules,
  },
  {
    id: 'typescript',
    title: 'Strict typed rules',
    appliesTo: 'every file in a TypeScript program',
    rationale:
      'No `any` or unsafe flows, handled promises, exhaustive switches, explained `@ts-expect-error`, type-only imports, `Array<T>`.',
    rules: typescriptRules,
  },
  {
    id: 'typescript-syntax',
    title: 'TypeScript syntax',
    appliesTo: 'TypeScript files',
    rationale:
      '`Array<T>`, separate type-only imports and exports, which `verbatimModuleSyntax` relies on.',
    rules: typescriptSyntaxRules,
  },
  {
    id: 'commonjs',
    title: 'CommonJS',
    appliesTo: '`.cjs` and `.cts` files',
    rationale:
      'A CommonJS file imports with `require`; converting it would change its module semantics.',
    rules: commonJsRules,
  },
  {
    id: 'toolpath',
    title: 'Package rules',
    appliesTo: 'every maintained JS/TS file',
    rationale: '`const` arrow functions and explained, narrow suppressions.',
    rules: toolpathRules,
  },
  {
    id: 'react-hooks',
    title: 'Hooks and React Compiler',
    appliesTo: 'React projects',
    rationale:
      'Rules of Hooks, dependencies, render purity, immutability, refs, and compiler diagnostics.',
    rules: reactHooksRules,
  },
  {
    id: 'react-quality',
    title: 'React quality',
    appliesTo: 'React projects',
    rationale:
      'Stable keys, context values, leaked conditional rendering, legacy APIs, explained compiler opt-outs.',
    rules: reactQualityRules,
  },
  {
    id: 'react-resources',
    title: 'Resource cleanup',
    appliesTo: 'React projects',
    rationale: 'Intervals, timeouts, and fetches started by an effect are cleaned up.',
    rules: reactResourceRules,
  },
  {
    id: 'react-dom',
    title: 'React DOM',
    appliesTo: "React projects with runtime 'dom'",
    rationale: 'Listeners and observers are removed; deprecated and unsafe DOM APIs are rejected.',
    rules: reactDomRules,
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    appliesTo: "React projects with runtime 'dom'",
    rationale:
      'Static JSX accessibility checks. Map custom components in `docs/react.md` when a check needs them.',
    rules: accessibilityRules,
  },
  {
    id: 'vitest',
    title: 'Vitest tests',
    appliesTo: 'unit test files in projects with a Vitest suite',
    rationale:
      'No focused, disabled, duplicate, or assertion-free tests; awaited async expectations.',
    rules: vitestRules,
  },
  {
    id: 'jest',
    title: 'Jest Expo tests',
    appliesTo: 'unit test files in projects with a Jest Expo suite',
    rationale: 'The same guarantees as Vitest, for the native runner.',
    rules: jestRules,
  },
  {
    id: 'testing-library',
    title: 'Testing Library',
    appliesTo: 'unit test files in DOM React projects',
    rationale: 'Awaited user events and queries, screen queries, no container access.',
    rules: testingLibraryRules,
  },
  {
    id: 'playwright',
    title: 'Playwright tests',
    appliesTo: 'browser test files in projects with a Playwright suite',
    rationale: 'Awaited actions, web-first assertions, and no sleeps, focused, or skipped tests.',
    rules: playwrightRules,
  },
  {
    id: 'engine',
    title: 'Engine boundary',
    appliesTo: "projects in a repository that selects the 'engine' profile",
    rationale:
      'Direct HTTP to a configured Engine origin stays in integration or compatibility modules.',
    rules: engineRules,
  },
]

/** Every rule identifier the policy can configure, for exception validation. */
export const knownPolicyRules = (): Set<string> =>
  new Set(POLICY_GROUPS.flatMap((group) => Object.keys(group.rules)))
