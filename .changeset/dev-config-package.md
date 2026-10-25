---
'@toolpath/dev-config': minor
---

Add `@toolpath/dev-config`: one versioned development standard for TypeScript repositories. A
repository declares its projects once in `dev.config.mjs`; rules, exact tool versions and CI policy
come from the package and change together in its releases. It is a dev dependency only and adds
nothing to an application's or library's runtime.

- `npx @toolpath/dev-config init` adds the standard: `dev.config.mjs`, native files that import the
  shared factories, scripts, the pre-commit hook, `.github/workflows/quality.yml`, a managed
  `AGENTS.md` section with `commit`/`pr`/`review` skills, and exact tool versions. `--dry-run`
  prints the whole change; an existing config that differs stops the run with a diff.
- `toolpath-dev check`, `lint`, `check-types`, `test` and `doctor` run strict TypeScript and ESLint 10
  policy (typed rules, runtime import boundaries, React and accessibility rules, the `toolpath/*`
  rules), every declared suite, and a read-only diagnosis. Exit codes are `0`/`1`/`2`.
- Formatting is automatic: the hook applies safe lint fixes and Prettier to staged files; CI checks
  formatting read-only. No one runs a formatter.
- Runner factories for Vitest, Playwright and Jest Expo; React Compiler adapters for Vite (plugin 5
  and 6), React Router, Expo, Babel and esbuild/tsup libraries, verified against compiled output.
- `/engine/testing`: deterministic Engine API scenarios validated against the pinned public
  contracts `api-1.29.1` and `api-1.32.0`, for the real `@toolpath/api` SDK through injected fetch,
  a Node HTTP server or MSW.
- A shared reusable workflow and `setup`/`check`/`result` actions pinned to the release's commit,
  with an aggregate `quality` check.

After upgrading, run `npx toolpath-dev sync` to update the managed files, tools and workflow
references.
