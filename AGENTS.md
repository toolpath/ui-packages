# Toolpath UI Packages Agent Guide

This repository publishes libraries. It is not an application: nothing here is deployed, and
every meaningful change lands in somebody else's `node_modules`. Six npm packages and one
PyPI package ship from this tree, alongside the examples that prove they work and the
generation pipeline that keeps two of them honest against the API.

That single fact sets the priorities. An accidental export is permanent, a wrong version bump
ships a break, and a dependency moved from `peerDependencies` to `dependencies` is an install
cost for everyone downstream. Those are the risks worth spending review attention on.

## What ships

| Package                  | Source                     | Published as                          |
| ------------------------ | -------------------------- | ------------------------------------- |
| `@toolpath/ui`           | `packages/ui/`             | npm — React component kit + theme     |
| `@toolpath/app-support`  | `packages/app-support/`    | npm — the logic an application reuses |
| `@toolpath/viewer`       | `packages/viewer/`         | npm — three.js/R3F part viewer        |
| `@toolpath/api`          | `packages/sdk-typescript/` | npm — generated TypeScript SDK        |
| `@toolpath/tool-drawing` | `packages/tool-drawing/`   | npm — 2D tool/holder elevation        |
| `@toolpath/tool-scraper` | `packages/tool-scraper/`   | npm — vendor tool-catalog scraping    |
| `@toolpath/tool-support` | `packages/tool-support/`   | npm — the cutting-tool domain         |
| `toolpath`               | `packages/sdk-python/`     | PyPI — generated Python SDK           |

`examples/typescript`, `examples/python`, and `examples/react-viewer` are workspace members but
are never published. They exist to exercise a package the way a consumer would.

## Project Map

- `packages/*/src/` is the shipped source. `packages/*/tests/` is its Vitest coverage.
- `packages/*/dist/` is build output. Never edit it, never commit a fix into it.
- `packages/sdk-typescript/src/generated/` and `packages/sdk-python/toolpath/generated/` are
  **generated**. `openapi/openapi.json` plus `codegen/*.yaml` and `scripts/generate-sdks.mjs`
  produce them; `pnpm generate:check` fails if the checked-in output drifts from a fresh run.
  A hand edit there survives exactly until the next generation.
- `openapi/` holds the pinned API contract and its `openapi.sha256`. `pnpm openapi:adopt` moves
  it forward; `pnpm openapi:verify` proves the checked-in document matches its hash.
- `packages/viewer/src/model/` and `src/render/` are pure — geometry, selection, camera, theme.
  The `.tsx` files at `packages/viewer/src/` are the React surface over them. New behavior that
  can be pure belongs in `model/` or `render/`, where it is cheap to test without a canvas.
- `packages/ui/src/` is **styling and display, and nothing else**. It is the component kit
  [Storybook](https://storybook.staging.toolpath.com) documents: a resource for reusable UI
  elements and a guide for building them. Every directory under it is one component's — its
  `.tsx`, and the hooks and helpers that component needs. Code that persists a preference,
  reads a route, calls an API or holds application state does not belong here however small it
  is, and a directory with no `.tsx` in it is that code arriving. It goes to
  `packages/app-support/` instead.
- `packages/app-support/src/` is the other half: the logic every Toolpath application was
  otherwise going to write for itself — preferences, contexts, route helpers. It ships two entry
  points, the root, which **imports no React** so a server route can read a stored value without
  bundling a renderer, and `/react` for the hooks and contexts. Its one runtime dependency is
  `@toolpath/tool-support`, and it never imports `@toolpath/ui`: the kit renders, this decides.
  `tests/boundary.test.ts` is the sensor for both claims.
- `packages/tool-drawing/src/` splits the same way the viewer does: `model/` and
  `render/*.ts` are pure geometry and layout, the `.tsx` files are the React surface. It ships
  three entry points — the root, `/geometry`, which imports no React and touches no DOM, and
  `/clearance`, the optional overlay — and a new file has to be reachable from one of them.
- `packages/tool-scraper/src/vendors/<brand>/` are the vendor adapters; everything above them in
  `src/` is the shared core, and `src/node/` is the filesystem/CLI entry point that the library
  half deliberately does not depend on.
- `packages/tool-support/src/` is the cutting-tool domain — what a tool, holder, collet and
  assembly are, and the arithmetic that follows. **It depends on nothing and every arrow points
  into it**: no runtime dependency, no peer, no React, no DOM, no `fs`, no `@toolpath/api`. That is
  the whole design, and it is what lets a Node ingest script, a server route and a React renderer
  share one answer. `tests/boundary.test.ts` is the sensor.
- `packages/viewer/fixtures/` holds captured Engine responses, kept byte-identical to what the
  API returned. Do not reformat them.
- `docs/` holds written plans, not steering. `docs/BOOTSTRAPPING-NPM-PACKAGES.md` is the one
  procedure an agent may need to follow.
- `examples/react-viewer/tests/` is the repo's only Playwright suite. `viewer.spec.ts` drives
  the example's default page and `orthographic.spec.ts` its `?projection=orthographic` one;
  each has click points scanned under its own camera, and `canvas.ts` holds what they share.

## Commands

Run from the repository root. This is a pnpm 10 / Turborepo workspace on Node 24; do not
substitute `npm`, `npx`, or a bare `tsc`.

| Purpose                              | Command                                             |
| ------------------------------------ | --------------------------------------------------- |
| Install dependencies                 | `pnpm install --frozen-lockfile`                    |
| The full gate                        | `pnpm check`                                        |
| Lint (ESLint + Ruff + yamllint)      | `pnpm lint`                                         |
| Type-check every workspace           | `pnpm check-types`                                  |
| Build every workspace and package    | `pnpm build`                                        |
| All tests                            | `pnpm test`                                         |
| One package's tests                  | `pnpm --filter @toolpath/viewer test`               |
| Browser tests only                   | `pnpm --filter @toolpath/example-react-viewer test` |
| Verify the pinned OpenAPI document   | `pnpm openapi:verify`                               |
| Regenerate the SDKs                  | `pnpm generate`                                     |
| Prove the generated SDKs are current | `pnpm generate:check`                               |
| Find dead code and unused deps       | `pnpm knip`                                         |
| Add a Changeset                      | `pnpm changeset`                                    |

`pnpm check` runs `openapi:verify`, `generate:check`, `lint`, `knip`, `build`, `check-types`, and
`test`, in that order, so the cheap contract checks fail before a build does.

**Docker must be running for `pnpm check` and for `pnpm generate`.** `scripts/generate-sdks.mjs`
runs the pinned `openapitools/openapi-generator-cli:v7.24.0` image, so `generate:check` fails at
the second step of the gate — before lint — when the daemon is stopped. That failure is an
environment prerequisite, not a finding about the change.

Two things about `pnpm test` are worth knowing before reading its output:

- It runs Playwright. `turbo run test` reaches every workspace with a `test` script, and
  `examples/react-viewer` builds and runs its browser suite there. CI installs Chromium before
  calling `pnpm check` for exactly this reason. A missing browser is a skipped check, not a
  passing one.
- It then runs `scripts/test-ui-package.mjs`, which is not a unit test: it runs `npm pack` on
  `packages/ui` and asserts the tarball's contents. A file that stops shipping fails here.
- It finishes with `scripts/check-release-build-order.mjs`, which reads `release:npm` and the
  workspace graph and proves the first builds every published package, and builds each one before
  the packages that import it. `release:npm` states its order by hand and runs only on `main`
  after a release pull request merges, so without this its first execution is the release it
  breaks.
- `scripts/check-release-trigger.mjs` reads the release workflow's push path filter and proves
  it runs on `.changeset/**` and on every published package's `src/**` and manifest. The filter is
  a roster, and it fails silently: the merge succeeds, CI is green, and nothing publishes. A pull
  request whose only release-relevant content was a Changeset used to do exactly that.
- Also here is `scripts/check-bootstrap-publish.mjs`, which proves the one manual publish in the
  repository goes through pnpm. Only pnpm rewrites a `workspace:` range to a real one at pack
  time, and the bootstrap runs once per package, by hand, for a package npm has never seen — so
  its first execution is the publish it breaks, permanently, because npm will not accept a second
  upload of a version.

## Rules with a sensor

A rule with a sensor is a fact about the code — the gate fails and the work stops. A rule
without one is a preference a reviewer carries in their head, and agents drift off those the
longer a session runs. This table is deliberately short and deliberately honest: when a
judgment rule starts being violated, give it a check rather than restating it here.

| Rule                                                                      | Proven by                             |
| ------------------------------------------------------------------------- | ------------------------------------- |
| No component defined inside another component                             | `pnpm lint`                           |
| Complete React hook dependency arrays                                     | `pnpm lint`                           |
| Python style in `packages/sdk-python` and `examples/python`               | `pnpm lint` (Ruff)                    |
| Workflow YAML style                                                       | `pnpm lint` (yamllint)                |
| The generated SDK sources match a fresh generation                        | `pnpm generate:check`                 |
| `openapi/openapi.json` matches its recorded hash                          | `pnpm openapi:verify`                 |
| A scraper vendor adapter imports no other vendor                          | `pnpm test` (`vendor-boundary`)       |
| Only a composition root reaches into `src/vendors/`                       | `pnpm test` (`vendor-boundary`)       |
| Every scraper vendor directory has a `scrape.ts`                          | `pnpm test` (`vendor-boundary`)       |
| `@toolpath/tool-support` imports nothing and declares no dependency       | `pnpm test` (`boundary`)              |
| `@toolpath/app-support`'s root entry imports no React                     | `pnpm test` (`boundary`)              |
| `@toolpath/app-support` never imports `@toolpath/ui`                      | `pnpm test` (`boundary`)              |
| One `25.4` in the whole tree                                              | `pnpm test` (`boundary`)              |
| `release:npm` builds a package before the ones that import it             | `pnpm test` (`release-build-order`)   |
| The bootstrap publish rewrites `workspace:` ranges, as pnpm does          | `pnpm test` (`bootstrap-publish`)     |
| A Changeset on `main` starts a release run                                | `pnpm test` (`release-trigger`)       |
| The viewer example mounts with a clean console, in both projections       | `pnpm test` (Playwright `openViewer`) |
| `@toolpath/ui` holds components only: every `src/` directory has a `.tsx` | `pnpm test` (`boundary`)              |
| `@toolpath/ui` imports no Toolpath sibling                                | `pnpm test` (`boundary`)              |
| `@toolpath/ui` ships its theme, `dist`, and `src` in the tarball          | `pnpm test` (`test-ui-package`)       |
| `@toolpath/ui` theme tokens and the built bundle agree                    | `pnpm test` (`tailwind-preset`)       |
| `@toolpath/tool-scraper` resolves and its errors are `instanceof`-safe    | `pnpm test` (`packaging`)             |
| No unreferenced export, file, or dependency                               | `pnpm knip`                           |
| A change under a package's `src/` carries a Changeset                     | CI (`release-intent.yml`)             |
| Formatting                                                                | Prettier, via the pre-commit hook     |
| TypeScript style beyond the above                                         | judgment                              |

What the sensors cannot carry:

- `packages/viewer`'s split — pure logic in `model/` and `render/`, React in the `.tsx` files —
  is judgment. Nothing fails when a calculation moves into a component; the cost shows up later
  as a behavior that can only be tested by rendering a canvas.
- Which dependencies are peers is judgment. `@toolpath/viewer` peers `react`, `react-dom`,
  `three`, `@react-three/fiber`, and `@react-three/drei`, and takes exactly one runtime
  dependency; `@toolpath/ui` peers `react`, `react-dom`, and `tailwindcss`. A consumer that
  ends up with two copies of `three` gets an empty scene, and no check in this repo sees it.
- `packages/tool-scraper/tests/conventions.test.ts` holds the CSV conventions themselves, but
  whether a vendor keeps them is asserted in that vendor's own test file, against the header
  its adapter really writes. Do not add a literal copy of a header to the conventions test —
  that second copy is the check being lost.
- The ESLint config carries `react-hooks/exhaustive-deps` partly so the viewer's two deliberate
  suppressions stay legal. A disable comment naming an unresolvable or disabled rule fails lint.
- **`pnpm knip` proves a symbol is unreferenced, not that it should go.** In a published package
  an unreferenced export has two correct fixes — drop the `export` keyword, or add it to the
  package's public entry — and knip cannot tell them apart. Ask which the symbol was for: a
  `Context` object or a provider's internal value type is plumbing, so un-export it; a type named
  by a public signature a consumer cannot otherwise write is a gap in the public surface, so
  publish it. `knip.json` models each package's entry points by hand because every manifest's
  `exports` map points at `dist/`; an entry point added to a manifest needs its `src/` counterpart
  added there too, or knip will call a whole live module dead.
- **The Changeset check watches `src/` and not the manifests.** `scripts/check-release-intent.mjs`
  lists `packages/ui/src/`, `packages/ui/tailwind-preset.cjs`, `packages/app-support/src/`,
  `packages/viewer/src/`, `packages/tool-scraper/src/`, `packages/sdk-typescript/src/`, `openapi/`,
  `codegen/typescript-fetch.yaml`, and `scripts/generate-sdks.mjs`. A `package.json` change that
  alters `exports`, `files`, `engines`, or a dependency is consumer-visible and needs a Changeset
  under the rules below, but no check will ask for one. That part is judgment until the script's
  path list grows.

## Public package releases

When changing a public package in a consumer-visible way, always add a Changeset in the same pull
request. Do this as part of the implementation; do not ask a human to create it later.

Changesets are Markdown files in `.changeset/` with this form:

```md
---
'@toolpath/viewer': patch
---

Fix camera reset after a report reload.
```

Use the package and bump that match the change:

| Changed area                                                                                                | Package                  |
| ----------------------------------------------------------------------------------------------------------- | ------------------------ |
| `packages/ui/src/` or `packages/ui/tailwind-preset.cjs`                                                     | `@toolpath/ui`           |
| `packages/app-support/src/`                                                                                 | `@toolpath/app-support`  |
| `packages/viewer/src/`                                                                                      | `@toolpath/viewer`       |
| `packages/sdk-typescript/src/`, `openapi/`, `codegen/typescript-fetch.yaml`, or `scripts/generate-sdks.mjs` | `@toolpath/api`          |
| `packages/tool-drawing/src/`                                                                                | `@toolpath/tool-drawing` |
| `packages/tool-scraper/src/`                                                                                | `@toolpath/tool-scraper` |
| `packages/tool-support/src/`                                                                                | `@toolpath/tool-support` |

- Public package manifest changes that alter exports, dependencies, peer dependencies, or shipped files
  also require the relevant package Changeset.
- Use `patch` for a backwards-compatible fix.
- Use `minor` for a backwards-compatible public capability or export.
- Use `major` for an incompatible public API, type, peer-dependency, or behavioral change.
- Name every affected package in one Changeset when work spans packages.
- Do not add a Changeset for docs, examples, app-only work, CI, or test-only changes unless a package
  consumer receives a change.

This is enforced. `.github/workflows/release-intent.yml` runs
`scripts/check-release-intent.mjs` on every pull request and fails when a release-sensitive path
changed without a matching Changeset. The `no-release-needed` label is the only exit, it is a
maintainer's call, and the pull request template requires the reason in writing. Do not reach for
the label to get a check green.

**`packages/sdk-python` is outside Changesets and takes no Changeset.** It is not an npm package,
the release workflow does not version it, and adding one would put a package name in a changelog
that never ships. Its version lives in its own `pyproject.toml`.

`packages/tool-scraper` publishes to npm as `@toolpath/tool-scraper` and takes a Changeset like any
other public package. It was `private` for one release cycle, which kept it out of `changeset
publish` and out of the first-publish scan in `scripts/check-npm-package-bootstrap.mjs`; that scan
still skips a private package, so a future one holds back no release. Its `0.1.0` was versioned in
that window and never reached npm, so `0.1.0` is what the maintainer bootstrap in
`docs/BOOTSTRAPPING-NPM-PACKAGES.md` publishes — the one manual publish npm requires before it will
accept a trusted publisher for a package it has not seen. Every release after that is the
workflow's.

Do not manually edit package versions or changelogs. The release workflow generates them in its
auto-merged release-metadata pull request.

## Safety

- npm publishing uses GitHub Actions OIDC trusted publishing. Never add an npm token to a
  workflow, a `.npmrc`, or the environment. The one exception is the documented manual bootstrap
  publish for a brand-new package, in `docs/BOOTSTRAPPING-NPM-PACKAGES.md`.
- Never ask a user to paste an API key, token, or private URL into chat, and never read, print,
  summarize, stage, or commit a `.env` file. Checking that one exists is safe; reading it is not.
- Examples and READMEs use placeholder keys. Keep them placeholders.
- `@toolpath/tool-scraper` fetches from third-party vendor sites. Route requests through
  `src/fetch.ts` rather than calling `fetch` from an adapter, keep the provenance receipt a
  scrape produces, and do not raise request volume or add a vendor without the user asking.

## Working Style

- Explain the intended change in plain language before a broad or risky edit.
- Make the smallest correct change. Do not refactor unrelated code or add dependencies without a
  concrete need and the user's approval — in a published package, a new dependency is a decision
  every consumer inherits.
- Preserve unrelated work already present in the working tree. Never reset, discard, or overwrite it.
- Treat tests as part of every behavior change, in the package that owns the behavior.
- After meaningful changes, run the relevant checks and report what passed, failed, or was skipped.

Before editing:

- Search for an existing pattern or shared helper before adding an abstraction, dependency, or
  duplicate. Check whether the behavior belongs in a package's pure layer rather than its React one.
- Decide which package's public surface the change touches, and whether it needs a Changeset.

After editing:

- Run the narrowest relevant test/type loop first — `pnpm --filter <package> test` — then broaden
  in proportion to cross-package risk, ending at `pnpm check` for anything consumer-visible.

## Validation

Run the narrowest relevant tests while implementing, then run the applicable broader checks before
completion. Public package changes must include tests when behavior changes.

Nothing configures coverage in this repo, so there is no coverage number to report. That is a gap
in what can be measured, not a failing check — do not substitute a different tool and call it
coverage.

## Formatting

The Husky pre-commit hook runs `lint-staged`, which runs Prettier over staged files. Run
`pnpm format` only when the user asks or the hook cannot be used. Never bypass a failed hook with
`--no-verify`.

## Git Workflow

- Inspect `git status` and the relevant diff before staging anything. Stage explicit paths only,
  never `git add .` or `git add -A`.
- Commit only when the user explicitly asks. Never add AI attribution or a co-author trailer; the
  `commit` skill has the full message rules.
- Never push as a side effect of committing. Push only when the user explicitly asks.
- Never force-push, bypass hooks, run `git reset --hard`, run `git clean`, or use `git checkout --`
  unless the user explicitly asks and understands the consequence.

### Pull request descriptions

Fill in `.github/pull_request_template.md` and keep it **as short as the change allows**. A
description is a pointer to the diff, not a second copy of it.

- State facts. No narration, no rationale the code or a Changeset already carries, no praise.
- Summary is a few lines or a short bullet list. One line per behavior a consumer sees.
- Name breaking changes and the opt-out for each. Nothing else earns a heading.
- Do not restate Changeset prose, commit bodies, file lists, diffstats, or test names.
- Under Validation, name only the commands actually run and their result.

## Review guidelines

IMPORTANT — these guidelines apply when reviewing code, and the `review-code` and `review-testing`
skills build on them. Ignore them otherwise.

- State objective facts only.
- No praise.
- No vague "might be" comments. Always give real evidence.
- Focus on blocking risks first. In this repo those are consumer-facing: an unintended change to a
  package's public surface, a version bump that does not match the change, a dependency or
  peer-dependency shift, generated code edited by hand, and a behavior change shipped without a test.
- Always check architecture correctness, performance impact, and maintainability.
- Flag unbounded work, unnecessary rerenders, per-frame allocation in a render loop, and growth in
  what a consumer downloads or installs.
