# Shared working standard

This repository uses the shared TypeScript standard from `@toolpath/dev-config`. The repository's own instructions, manifests, and code come first: its architecture, commands, runtime versions, and explicit exceptions specialize this baseline.

## Before changing code

- Read the repository's instructions, the affected package's README and manifest, and `dev.config.mjs`, which declares each project's root, runtime, TypeScript program, and test suites.
- Inspect `git status` and the current branch. Preserve unrelated work: never discard, revert, reformat, or commit changes you did not make.
- Change the behavior the task calls for. Avoid broad cleanup, speculative abstractions, and dependencies without a concrete need.
- Prefer existing modules and published packages over parallel implementations. Keep generated files generated: fix the generator or its inputs.

## Checks

Run the commands through the repository's package manager (`pnpm exec toolpath-dev …` or `npx toolpath-dev …`):

| Command                                       | Use                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `toolpath-dev check --project <name>`         | Focused gate while working: prerequisite builds, lint, types, unit tests |
| `toolpath-dev check`                          | The complete local gate, before you report the work finished             |
| `toolpath-dev lint`, `check-types`, `test`    | One stage; `test --project <name> -- <file>` runs one file of a suite    |
| `toolpath-dev test --suite <project>:<suite>` | A declared browser, integration, or native suite                         |
| `toolpath-dev doctor`                         | Read-only diagnosis of configuration, tools, hooks, and CI wiring        |

- Run narrow checks first, then the complete gate. A focused check is not a substitute for the final one.
- Formatting is automatic. The pre-commit hook applies safe lint fixes and formats staged files; CI verifies formatting without changing anything. Never run a formatter or a format check yourself, and never add one to a script or instruction.
- `toolpath-dev lint:fix` applies safe ESLint fixes when you want them before a commit. It is optional.
- The lint and type policy is shared. Fix the code rather than the rule. A justified exception is a line-scoped `// eslint-disable-next-line <rule> -- <reason>` or a narrow `exceptions` entry in `dev.config.mjs` with its reason; never a file-wide disable, `@ts-ignore`, or a skipped check.
- A declared suite must discover and run tests; an empty suite fails. Do not add `.only`, unexplained skips, automatic retries, sleeps used as synchronization, or code coverage.
- Test behavior at the boundary that owns it: pure logic in unit tests, components through user-visible behavior, browsers and services in their declared suites. A mock-only test does not prove that a real service boundary works.

## Commits, pull requests, and reviews

- Use the repository's `commit`, `pr`, and `review` skills.
- Stage by explicit path; never `git add -A` over a tree you have not inspected. Never stage secrets, private environment files, or build output.
- Let hooks run. Never use `--no-verify`, `HUSKY=0`, or another bypass. When the hook stops a commit, fix what it reports and commit again; your staged and unstaged changes are preserved.
- Do not push, open, merge, or mark a pull request ready, publish packages, or change release tags unless asked. Keep a pull request a draft when asked.
- A review reports evidence-backed defects for the exact revision it read and changes nothing unless asked.

## Output and reporting

- Keep output bounded. Passing commands print one summary line; open full logs only to diagnose a failure.
- Report each meaningful check as passed, failed, or skipped with its reason. A missing browser, service, credential, or tool is a prerequisite failure, never a pass.
- Never weaken assertions, hide failures, or change environments, dependency pins, or configuration to make a check pass.
- Keep secrets out of chat, logs, source, fixtures, and commits. Use placeholder credentials. Do not read private environment files to discover conventions.
