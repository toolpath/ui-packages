# Maintenance

For people changing @toolpath/dev-config itself, in `packages/dev-config` of ui-packages.

## Where things are defined

| What                                         | Defined once in                                                      |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Every exact tool version, runtime, CI limits | `src/policy/toolchain.json` (read by the CLI and the source actions) |
| The lint rule map and its rationale groups   | `src/policy/rules.ts` (table in [policy](policy.md))                 |
| File conventions, timeouts, worker ceilings  | `src/policy/conventions.ts`                                          |
| TypeScript presets                           | `assets/typescript/*.json`                                           |
| Formatting policy                            | `src/prettier/index.ts`                                              |
| Configuration schema                         | `src/config/types.ts` and `src/config/validate.ts`                   |
| Managed native files and scripts             | `src/sync/templates.ts`, `src/sync/desired.ts`                       |
| Agent instructions and skills                | `assets/agents/`, `assets/engine/agents/`, `assets/claude-code/`     |
| Pinned third-party actions                   | `src/ci/pins.json`                                                   |
| Engine contracts                             | `contracts/engine/<id>/` and `toolchain.json` `engine.contracts`     |

`package.json` dependency and peer versions must agree with `toolchain.json`; a test checks it.

## Checks

`pnpm check:dev-config` (or `pnpm --filter @toolpath/dev-config check`) builds once, lints and
type-checks the package with its own built policy, runs its tests, then:

- `test:package`: packs with pnpm and installs the tarball into disposable npm and pnpm consumers
  outside the monorepo: contents, imports, declarations, optional-peer isolation, the CLI,
  `init`/`sync`/`doctor`/`check`, the hook, and both package managers.
- `test:compatibility`: the explicit matrix for both TypeScript lines, every React adapter, the
  native runner, both Engine SDK channels, and npm/pnpm consumption. It installs pinned tools
  from the registry into prepared environments.

Both create everything under the system temporary directory and remove it unless `--keep` is
passed. The package-local scripts build first only when `dist` is older than its inputs.

## Adding a profile, adapter or rule

Add it generically: a profile is selected by project facts (`runtime`, `react.adapter`, suite
runner, `engine`), never by repository names or paths. A new rule goes into the right group in
`rules.ts` with tests; a package rule gets valid, invalid, edge and fix tests and a section in
[policy](policy.md). A newly enforced rule is a breaking policy change (below).

## Engine contracts and SDKs

Contracts are immutable: a new contract is a new directory and ID, never an edit. Add the bytes
from the public endpoint, verify the SHA-256 against the provenance you record, add the pin to
`toolchain.json` with its SDK artifact, and run `toolpath-dev engine verify-contract` against the
target deployment. Ordinary tests never fetch contracts.

## Action pins and caller workflows

Third-party actions are pinned to full commit SHAs in `src/ci/pins.json`, with the version they
correspond to. Update a pin by resolving the tag's commit with `gh api` and verifying it is the
official repository's; the rendering tests reject any mutable reference.

## Release identity

`dist/release.json` binds the package to the commit it was built from: version, policy version,
toolchain, repository, full source SHA, and the workflow and action references. A normal build
writes `development` metadata, which `init` and `sync` refuse. Publishing runs `prepublishOnly`,
which rebuilds with `--release` and refuses a dirty tree under the release paths or a commit that
does not record the version being packed. Consumers' generated workflows reference that exact SHA,
so a package version and its CI policy upgrade together.

## Versions and Changesets

Every consumer-visible change needs a `@toolpath/dev-config` Changeset, including changes to the
shared workflow and actions (`release-intent` checks those paths).

- Patch: a fix that rejects no correctly supported consumer.
- Minor: a new opt-in profile, adapter or export.
- Breaking: a newly enforced rule or stricter default, a formatting change, a raised runtime or
  peer floor, a new required CI stage, a schema change, or incompatible helper behaviour.

The Changeset says what a consumer must do: usually `npx toolpath-dev sync`, plus any migration.

## Agent assets

Edit the canonical files in `assets/`. Installed copies are generated from them; never keep a
second copy of a skill in the package. Consumers who edit a managed block keep their edits through
the three-way merge, and an overlapping change stops their `sync` with a patch to review.

## Performance

`pnpm --filter @toolpath/dev-config benchmark` measures cold and warm wall time, peak memory where
the platform reports it, process counts and successful stdout bytes for a Node, a React, a focused
workspace and an Engine scenario. Optimize only after measuring, and never by weakening a check:
no per-file typed-lint cache, no skipped programs, no changed-files-only gate.
