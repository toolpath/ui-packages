---
name: review-testing
description: Audit the Toolpath UI packages' Vitest, Playwright, packaging, and CI coverage for meaningful behavioral gaps without changing tests.
---

# Review Testing

This is a read-only test review. Audit what the tests prove rather than counting test files.
Follow the review guidelines in `AGENTS.md`: objective facts, evidence, no praise.

## The layout

- `packages/<name>/tests/*.test.{ts,tsx}` — Vitest, per package, run by that package's own
  `test` script.
- `examples/react-viewer/tests/viewer.spec.ts` — the repo's only Playwright suite. It builds the
  example first.
- `scripts/test-ui-package.mjs` — runs `npm pack` on `packages/ui` and asserts the tarball's
  contents. Part of `pnpm test`.
- `scripts/test-typescript-sdk-package.mjs` — the same idea for `@toolpath/api`, but it is **not**
  in `pnpm test`; only `pnpm release:typescript-sdk:check` runs it. A packaging regression in the
  SDK therefore reaches a release candidate rather than a pull request. Say so if the diff makes
  that more likely.
- `.github/workflows/ci.yml` installs Chromium and runs `pnpm check` on pull requests and pushes
  to `main`. `.github/workflows/release-intent.yml` runs the Changeset check separately.

`turbo run test` reaches every workspace with a `test` script, so `pnpm test` runs Playwright as
well as the unit suites. `packages/ui`'s `test` builds first and asserts against the built
bundle. Report a missing Chromium as skipped, never as passed.

Run the narrowest relevant command first, plus `pnpm check-types` when a type error could hide a
test failure. Coverage tooling is not configured; report that plainly, do not install it, and do
not treat a numeric target as the goal.

## Where a test belongs

A package's behavior is tested in that package's `tests/`, against its own source. The examples
exist to prove a consumer can mount and use the package — integration, not units.

So: a viewer behavior asserted only through `examples/react-viewer/tests/viewer.spec.ts` is a
finding on placement alone, regardless of what it asserts. Camera framing, projection,
retargeting, picking, region indexing, normals, adjacency, and theme resolution are all
computable without a browser, and `packages/viewer/tests/` already tests each of them that way.
A Playwright assertion is the right home only for something that needs a real canvas, a real
pointer, or a real build.

The reverse is also a finding: an example changed to accommodate a package bug, instead of the
package being fixed.

## Behavioral seams to prioritize

- viewer: camera and projection math, retargeting, picking and selection, region indexing,
  geometry normalization, normals and adjacency, section views, theme resolution;
- viewer engine entry (`src/engine/`): report normalization and the geometry cache, against the
  captured fixtures in `packages/viewer/fixtures/`;
- ui: component behavior and the theme/token contract, asserted against the built bundle;
- tool-scraper: each vendor adapter's records and headers, identity and provenance, thread and
  unit conventions, the fetch layer's error types;
- sdk-typescript: that the packaged artifact resolves and its types are what a consumer imports;
- the example flows, as integration only.

## Sensors, audited as rules rather than as coverage

Several tests here read structure rather than exercise behavior. They are rules, and a failure
in one is the rule being broken rather than a flaky test:

- `packages/tool-scraper/tests/vendor-boundary.test.ts` — derives its module lists by walking
  `src/`, so a new adapter is covered the moment it lands. Check that it still walks rather than
  having acquired a hard-coded roster; a rostered version goes stale on the next file.
- `packages/tool-scraper/tests/conventions.test.ts` — holds the shared CSV conventions. Whether a
  vendor keeps them belongs in that vendor's own test, against the header its adapter really
  writes. A header literal copied into the conventions test is the check being lost, and that is
  a finding.
- `packages/tool-scraper/tests/packaging.test.ts` — that the package resolves as a consumer gets
  it and its errors survive `instanceof`.
- `packages/ui/tests/tailwind-preset.test.ts` — that the built bundle and `theme.css` agree.
- `scripts/test-ui-package.mjs` — that the published tarball still contains what it must.
- `pnpm generate:check` and `pnpm openapi:verify` — the generated SDKs and the pinned contract.
- `pnpm knip` — that no file, export, or dependency sits unreferenced. It is a rule about reach,
  not about tests: a symbol one test imports counts as referenced, so a green run says nothing
  about whether anything is asserted.

Separately from missing tests, report which behaviors and which AGENTS.md rules have no
automated proof at all — nothing in Vitest, Playwright, `eslint.config.js`, or a script that
would fail if they were broken. Naming that set is itself the finding, because those are the
rules a long session drifts off first. Check the AGENTS.md sensor table in both directions: a
rule marked judgment that now has a sensor is as stale as one claiming a sensor it lacks.

## The public surface no test reaches

`pnpm knip` exempts each package's entry points, because a published export having no in-repo
caller is the normal state of a library. Drop that exemption and the same graph answers a
different question:

```sh
pnpm exec knip --no-config-hints --include-entry-exports
```

What it lists is every public export that no source file **and no test** in this repository
mentions. That is the closest thing here to a map of untested public surface, and it is large —
around 400 symbols, most of them in `packages/viewer` and `packages/ui`, because the suites drive
behavior through a handful of entry points rather than touching each export by name. Get the
current set rather than trusting that number.

It is a pointer, not a metric, and it is **not coverage** — do not present it as one, and do not
report a percentage from it:

- It is not a gate and never should be. Do not propose wiring it into `pnpm check`.
- It answers "is this name mentioned anywhere", not "is this behavior asserted". An export a test
  imports and never exercises does not appear.
- `export *` chains and namespace imports hide references, so a symbol's absence from the list is
  much weaker evidence than its presence on it.

Use it to ask which _behaviors_ on the list deserve a test. A viewer camera, picking, or section
export sitting there is a finding; a type alias or a constant is not. Naming three or four real
ones beats reproducing the list.

## Known gaps — state them, do not rediscover them

These are facts about the repository as it stands, not findings to report fresh each time.
Report them only when the change under review makes one of them newly relevant:

- No coverage tooling is configured anywhere.
- `packages/sdk-python` has no tests, and `pnpm test` runs no Python tests at all — `pnpm
build:python` only byte-compiles `examples/python`.
- `packages/sdk-typescript` has no `test` script; its only automated proof is `generate:check`,
  `check-types`, and the packaging script that runs at release time.

## Reporting

Flag weak assertions, implementation-mirroring tests, over-mocking inside a single layer, missing
error and edge-state cases, focused or skipped tests, and CI steps that can hide a failure. Do
not recommend tests for static presentation or for framework bootstrap with no behavior. Give
each finding a path, the missing behavior, and the most suitable level — pure unit in the
package, component, packaging script, or Playwright — then a short priority-ordered plan if
action is warranted.
