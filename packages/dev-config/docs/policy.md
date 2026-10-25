# Policy

What the standard enforces, where, and why. The effective rule map is written out rule by rule in
`src/policy/rules.ts`; a plugin release that adds or changes a preset changes nothing until a
dev-config release adopts it. Every entry is `error` or `off`: lint allows zero warnings, so a
warning would only be an error that looks optional. To see the exact rules for one file, run
`npx eslint --print-config <file>` in the repository.

## TypeScript

Every check program has `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`,
`verbatimModuleSyntax` and `isolatedModules`, and `skipLibCheck` is off. `doctor`, `check` and
`check-types` refuse a program without them. A real declaration incompatibility in a dependency
needs a fix or a narrow, explained workaround, not a switch that skips every declaration.

| Preset         | For                                  | Module resolution | Globals                |
| -------------- | ------------------------------------ | ----------------- | ---------------------- |
| `base.json`    | Building your own preset             | —                 | none                   |
| `node.json`    | Node projects and tooling            | NodeNext          | Node                   |
| `browser.json` | DOM applications and bundled code    | Bundler           | DOM                    |
| `library.json` | Renderer-neutral published libraries | NodeNext          | none (no DOM, no Node) |

Source, tests and maintained configuration are all checked. A universal or native project names a
separate `testTsconfig`, so test-runner and Node types reach only its test program. JavaScript a
project owns is checked too (`allowJs` and `checkJs`); CommonJS files keep `require`.

## Lint groups

| Group                | Applies to                                        | Enforces                                                                                                        |
| -------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `javascript`         | Every maintained JS/TS file                       | Real defects (unreachable code, invalid regexes, self-comparison), `curly: all`, `const`, `eqeqeq`.             |
| `typescript-checked` | Every file in a TypeScript program                | Turns off core rules the strict checker already reports, so a defect produces one message.                      |
| `typescript`         | Every file in a TypeScript program                | No `any` or unsafe flows, handled promises, exhaustive switches, explained `@ts-expect-error`, no `@ts-ignore`. |
| `typescript-syntax`  | TypeScript files                                  | `Array<T>`, separate type-only imports and exports, as `verbatimModuleSyntax` requires.                         |
| `commonjs`           | `.cjs` and `.cts` files                           | Allows `require`, which is how a CommonJS file imports.                                                         |
| `toolpath`           | Every maintained JS/TS file                       | `const` arrow functions; narrow, explained suppressions.                                                        |
| `react-hooks`        | React projects                                    | Rules of Hooks, dependencies, render purity, immutability, refs, and React Compiler diagnostics.                |
| `react-quality`      | React projects                                    | Stable keys, context values, leaked conditional rendering, legacy APIs, explained compiler opt-outs.            |
| `react-resources`    | React projects                                    | Intervals, timeouts and fetches started by an effect are cleaned up.                                            |
| `react-dom`          | React projects with runtime `dom`                 | Listeners and observers are removed; deprecated or unsafe DOM APIs are rejected.                                |
| `accessibility`      | React projects with runtime `dom`                 | Static JSX accessibility checks.                                                                                |
| `vitest`             | Unit tests of projects with a Vitest suite        | No focused, disabled, duplicate or assertion-free tests; awaited async expectations.                            |
| `jest`               | Unit tests of projects with a Jest Expo suite     | The same guarantees for the native runner.                                                                      |
| `testing-library`    | Unit tests of DOM React projects                  | Awaited user events and queries, screen queries, no container or node access.                                   |
| `playwright`         | Browser tests of projects with a Playwright suite | Awaited actions, web-first assertions, no sleeps, focused or skipped tests.                                     |
| `engine`             | Repositories that select the `engine` profile     | Direct HTTP to a configured Engine origin stays in integration or compatibility modules.                        |

Not part of the standard, by design: mandatory return annotations, bans on loops or classes,
function-length or complexity limits, `memo`/`useMemo`/`useCallback` everywhere, and duplicate
formatting rules (Prettier formats at commit).

### Runtime and import boundaries

A project's `runtime` decides its globals and the modules it may import. Production code in a
`dom`, `native` or `universal` project cannot import Node builtins; `native` and `universal`
code cannot import `react-dom`; `dom` and `universal` code cannot import `react-native`. Tests run
under Node, so they may use its APIs. React is imported by name (`import { useState } from
'react'`), never as a default or namespace import. With the `engine` profile, `@toolpath/api`'s
internal paths are never imported, and its runtime API is used only in the configured integration
modules; type-only imports are fine anywhere.

These boundaries use `@typescript-eslint/no-restricted-imports`. A repository's own architectural
boundaries go in `createEslintConfig(config, { restrictedImports: [...] })`, which uses core
`no-restricted-imports` so the two never overwrite each other.

## Package rules

### toolpath/prefer-const-arrow

Declare functions as `const` arrow functions where an arrow has the same semantics. Function
syntax stays where behaviour needs it: generators, `this`, `arguments`, `new.target`,
construction (`new` or `.prototype`), overloads, ambient declarations, and a default-exported
named function (framework module shapes such as route components). The fix keeps generics
(`<T,>` in TSX), `async` and comments. It never rewrites an exported function (inline or through
`export { name }`): an exported function is initialized before a circular importer runs and a
`const` is not, so exports get a suggestion to apply by hand. It also offers only a suggestion for
a function used before its declaration, and nothing for one that is reassigned or whose comment
would be lost. When code relies on hoisting, keep the function and suppress the line with the
reason.

### toolpath/no-blanket-quality-disable

Every suppression names its rules and gives a reason: `// eslint-disable-next-line rule -- why`.
A directive with no rules (`/* eslint-disable */`) is an error even though it would hide its own
report: the CLI counts this rule's suppressed messages as errors. Critical rules (unsafe types,
unhandled promises, Hooks and compiler rules, focused tests, this package's rules) may be
suppressed only line by line. Inline rule configuration (`/* eslint rule: off */`) is rejected;
configuration belongs in `dev.config.mjs`. Comments are read from the syntax tree, so
directive-like text in strings and test fixtures is never inspected. ESLint itself reports unused
suppressions.

### toolpath/require-compiler-optout-reason

A real `"use no memo"` (or legacy `"use no forget"`) directive, in a module or function prologue,
needs an adjacent comment — on the line above or at the end of its line — naming the
incompatibility or deliberate boundary. A string anywhere else is not a directive.

## Exceptions

`exceptions` in `dev.config.mjs` is the only structured way to narrow a rule:

```js
exceptions: [
  {
    rule: '@typescript-eslint/no-explicit-any',
    files: ['src/legacy/wire.ts'],
    reason: 'The legacy wire format is typed in its own change',
    issue: 'https://github.com/example/repo/issues/12',
    expires: '2027-03-31',
  },
],
```

The rule must be one the configuration's policy enables; files must be narrow globs (a pattern
must name a directory or file, and may not cover a whole project); the reason is required. An
expired entry fails. `doctor --verbose` lists active exceptions, and plain `doctor` counts them.
Expiry is optional: a justified permanent exception does not need a date that breaks builds.

Generated code is excluded with a `generated` entry, which also needs a reason and a narrow glob.
Generated exclusions remove files from lint and type ownership, not from formatting; byte-retained
files use `formatIgnore`.

## What the gate guarantees

- Every maintained JS/TS file belongs to exactly one program (a project, or the `tooling` scope);
  a file no program owns is a configuration error, not a silently skipped file.
- Typed lint uses each project's declared program. There is no default-program fallback and no
  per-file lint cache: an edit in one file can change another file's types without changing its
  bytes.
- A native ESLint config that changes a baseline rule for any file is refused by `lint`, `check`
  and the hook.
