---
name: review-code
description: Review a change to the Toolpath UI packages for concrete public-API, correctness, architecture, performance, and maintainability defects without editing it.
---

# Review Code

This is a read-only review. Inspect the relevant diff and code first, then report objective,
actionable findings ordered by severity. Do not make fixes.

Follow the review guidelines in `AGENTS.md`: objective facts, no praise, no "might be" without
evidence, and a path plus evidence plus impact plus a remediation direction for every finding.

## What this repo makes a change expensive

Nothing here is deployed. Every consumer-visible change lands in somebody else's
`node_modules`, at a version they chose, and cannot be taken back. That is where the review's
attention belongs — not on the app-shaped risks (auth, sessions, request handling) this
repository does not have.

## Gates you can run

- `pnpm lint` — ESLint, Ruff, and yamllint.
- `pnpm check-types` — every workspace.
- `pnpm knip` — files, exports, and dependencies nothing references. Part of `pnpm check`.
- `pnpm --filter <package> test` for the package under review; `pnpm test` when the change
  crosses packages. `pnpm test` also runs Playwright and the `npm pack` check, so it is slow.
- `pnpm openapi:verify` and `pnpm generate:check` whenever the diff touches `openapi/`,
  `codegen/`, `scripts/generate-sdks.mjs`, or a generated directory.
- `node scripts/check-release-intent.mjs origin/main` — the Changeset check CI will run.

There is no coverage tooling configured. State that as unavailable rather than substituting a
different tool or treating its absence as a passing result.

## What is already proven, and what is left for you

These have sensors. Run them, say they are clean, and move on — do not spend the review
restating them:

- a component defined inside another component, or an incomplete hook dependency array;
- generated SDK sources that drift from a fresh generation, or an `openapi.json` that no longer
  matches its hash;
- a scraper vendor adapter importing another vendor, the core reaching into `src/vendors/`, or a
  vendor directory with no `scrape.ts`;
- `@toolpath/ui` dropping a file from its published tarball, or its theme tokens disagreeing with
  the built bundle;
- an export, file, or dependency that nothing in the repository references;
- a release-sensitive path changed without a Changeset.

The review is for what no check sees.

### The public surface

- What does the diff add to `src/index.ts` — or to `src/engine/index.ts` for the viewer? An
  export is a permanent commitment, and the diff is the last cheap moment to refuse one.
- Do `exports`, `files`, `main`, and `types` in the manifest still describe what the build
  actually produces? `packages/viewer` and `packages/ui` are ESM-only with a `types` condition.
- Does the emitted `.d.ts` leak a type the package does not intend to publish, or reference a
  type from a `devDependency` a consumer will not have installed?
- `pnpm knip` now catches the helper exported "for a test" or "for now", so do not hunt for it by
  hand. What it hands you instead is a decision it cannot make. An unreferenced export has two
  correct fixes and the right one depends on what the symbol was for: a `Context` object or a
  provider's internal value type is plumbing, and should lose the `export` keyword; a type that a
  public signature already names — so a consumer can hold the value but cannot write its type — is
  a hole in the public surface, and should be added to the entry point instead, as a `minor`.
  Reading every knip finding as "delete it" is how a package loses a type its own exported
  functions still mention.
- Un-exporting is not free everywhere. `@toolpath/ui` and `@toolpath/viewer` build with tsup,
  which keeps a module-private type as a private declaration in the emitted `.d.ts`.
  `@toolpath/api` and `@toolpath/tool-scraper` build with plain `tsc`, where a non-exported type
  named by an exported signature can fail declaration emit outright. `pnpm build` is the check
  either way; require it in the diff's own package before accepting the change.
- A knip finding under `packages/sdk-typescript/src/generated/` means `knip.json` stopped ignoring
  that directory, not that there is dead code to remove. Hand edits there last until the next
  generation and `pnpm generate:check` fails. Report the config change, not the symbol.

### The version bump

- Does the Changeset exist, name every affected package, and carry the bump the change actually
  deserves under the AGENTS.md table? A removed or renamed export, a changed argument, a widened
  peer range, and a changed default are `major` — patch-labelling one is a finding, and it is
  the finding most likely to reach a consumer as a broken build.
- A Changeset whose summary describes the session rather than the change is a finding too: it
  becomes the changelog line a consumer reads.

### Dependencies

- Is a new package a `dependency` that should be a peer, or the reverse? `@toolpath/viewer`
  peers `react`, `react-dom`, `three`, `@react-three/fiber`, and `@react-three/drei` precisely
  so a consumer has one copy of `three`; a runtime dependency on any of them yields a second
  copy and an empty scene, with nothing failing at build time.
- Is a new runtime dependency load-bearing, or a convenience? Every one is installed by every
  consumer.
- Does anything in a library path import from `node:*` or assume a DOM global? `@toolpath/ui`
  and `@toolpath/viewer` are imported by server-rendered applications. `@toolpath/tool-scraper`
  keeps its filesystem and CLI code in `src/node/`; the library half must stay clean of it.

### Correctness in the pure layers

- `packages/viewer/src/model/` and `src/render/` are where geometry, camera, picking, selection,
  and theme decisions live. A calculation added to a `.tsx` component instead is a finding on
  placement: it can then only be tested by rendering a canvas.
- Per-frame work — allocation in a render or controls callback, a recomputation that could be
  memoised, a listener never removed — matters more in a viewer than in an app screen.

### The scraper

- Requests go through `src/fetch.ts`, not a bare `fetch` in an adapter.
- A scrape still produces its provenance receipt, and CSV conventions are asserted in the
  vendor's own test against the header its adapter really writes — never as a literal copied
  into `conventions.test.ts`.

## Blast radius

For the change under review, ask what the next plausible requirement in the same area would
cost, and ask it across the package boundary: if a consumer on the last published version would
have to change their own code to take this, that is the finding, not the edit.

Some files already amplify that cost. Get the current set rather than trusting a list:

```sh
find packages/*/src -name '*.ts' -o -name '*.tsx' | grep -v '/generated/' \
  | xargs wc -l | sort -rn | sed -n '2,9p'
```

`kennametal.ts`, `viewer.tsx`, `regofix/scrape.ts`, `table.tsx`, `part-mesh.tsx`,
`render/controls.ts`, and `render/view-cube.ts` have held the top of that list. Size alone is
not a finding. Growth in one of them, in a change that had a seam available, is.

## Guides and sensors

When a finding is a rule a command could prove rather than a judgment about this diff, say so
and name the check that would prove it — a rule in `eslint.config.js`, an assertion in a
package's tests, or a structural test of the kind `vendor-boundary.test.ts` already is. A
convention repeated in review is a convention that will be violated again.

The AGENTS.md sensor table marks its own unproven rules as judgment. If the diff gives a
judgment rule a sensor, or breaks one the table claims is proven, say so — the table going
stale is itself a finding.

## Reporting

Also flag demonstrated duplication, missing error handling, unbounded work, and growth in what a
consumer downloads or installs. Do not make speculative refactor suggestions. For every finding
give the exact path, evidence, impact, and a concrete remediation direction; note when a safe
refactor needs tests first. End with a prioritized plan only when the findings justify one.
