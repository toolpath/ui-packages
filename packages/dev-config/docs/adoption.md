# Adoption

How a repository takes on the standard, and how an existing one migrates. Adoption is always its
own change in the adopting repository; installing this package never edits a repository by itself.

## A new repository

Run `init` with the project facts (see the [README](../README.md#start) for complete single-project,
React/Vite, workspace and Expo examples). It needs a `package.json`, and a package manager it can
identify: the `packageManager` field or exactly one lockfile. With both lockfiles and no
declaration it stops and asks for `--package-manager npm|pnpm`; it never deletes a lockfile.

Review the result, run `npm run check` (or `pnpm check`), and commit through the hook. Then:

1. Push the branch and open a pull request. The generated `.github/workflows/quality.yml` runs
   the shared workflow at the release's commit.
2. After its first run, require the check named `quality` in branch protection (a repository
   administrator's change; see [CI](ci.md#branch-protection)).

## An existing repository

`init --dry-run` shows the whole change. It stops before writing when something would compete
with a managed file:

| It finds                                          | Do this                                                                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.eslintrc*` or another `eslint.config.*`         | Move repository-specific import boundaries into `createEslintConfig(config, { restrictedImports })`, extra plugins into `extend`, and delete the old file. |
| `.prettierrc*`, a `prettier` field                | Delete it. Byte-retained files go in `formatIgnore` with a reason.                                                                                         |
| A lint-staged configuration                       | Delete it; `toolpath-dev hooks pre-commit` owns staged fixes and formatting.                                                                               |
| A script named like a managed one (`lint`, …)     | Rename or remove it; the standard's scripts are fixed.                                                                                                     |
| A runner config that does not call the factory    | Rebuild it with the factory; move setup files and aliases into its `extend` options.                                                                       |
| An existing `prepare` script                      | Nothing: `init` composes it with `toolpath-dev hooks install`.                                                                                             |
| A React build config without the adapter          | Add the adapter's factory to it ([React](react.md)); `init` writes one when the project has none.                                                          |
| A pre-commit hook running lint-staged or Prettier | Remove those commands; keep the hook's other steps. The managed block runs beside them.                                                                    |

Then fix what `check` reports. Resolve real violations rather than suppressing them; the standard
has no baseline file. A file that genuinely cannot meet a rule yet gets a narrow exception with a
reason (and an issue link), or a line suppression with `-- reason`.

Repositories with a host-specific gate (contract regeneration, CAD validation, native artifacts)
keep it as an explicit additional required check beside `quality`.

## Updates

After upgrading the package, `npx toolpath-dev sync` (preview with `--dry-run`). Unchanged managed
text is replaced; local edits are merged; an edit that overlaps a change stops with a proposed patch
and an explanation, before any managed file is touched. Release notes say when an upgrade enforces
something new.

## Recovering from a failed install

`init` and `sync` validate the whole plan before writing, but a package-manager install can still
fail afterwards (network, registry). The command then lists the files it had written and saves the
complete change in `.toolpath/dev-config-recovery.patch`. Fix the cause and rerun, or restore
those files with Git.

## Follow-up: adopting the standard in ui-packages

ui-packages hosts this package but has not adopted its baseline. A separate migration:

1. Inventory existing programs, generated and retained assets (`openapi/`, `fusion/`,
   `mastercam/`, viewer fixtures, generated SDKs), platform boundaries, test prerequisites
   (Docker, Chromium, uv), the Python and CAD checks, and release-specific builds.
2. In a separate branch, add the root dev dependency and a project registry. Keep this package's
   bootstrap acyclic and its declarations usable without SDK generation.
3. Migrate logic packages, scripts and examples, then React packages, in reviewable batches.
   Resolve real violations; do not generate a suppression baseline.
4. Wire the compiler into the shipped UI, viewer and drawing builds, including native variants and
   minimum peer compatibility, and check tarballs, declarations and platform boundaries.
5. Adopt the shared hooks and formatting, then the shared CI, keeping the OpenAPI, Python, CAD and
   native artifact checks as explicit required extensions.
6. Reconcile `.claude/skills` with the shipped skills, keeping local domain, release and
   architecture rules.
7. Require the aggregate `quality` check after observing the generated workflow, remove the old
   configuration only once equivalent required checks pass, and measure the developer loop.

Other TypeScript repositories follow the same path as separate adoption changes.

## Follow-up: retiring agent-config

After a release is published, demonstrate the agent assets in a disposable repository. Then, with
explicit authorization, add a pointer to this package in agent-config's README and archive it,
keeping its content and history readable. Nothing in this package depends on that step.
