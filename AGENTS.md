# Working on Toolpath UI packages

This public repository ships reusable packages and consumer examples. Preserve compatibility for users who install a published version independently of Toolpath apps. Keep this guide focused on decisions; package READMEs document usage, and source/tests define implementation details.

## Domain model and terminology

Toolpath analyzes CAD geometry to help a shop decide whether and how to machine a part. Applications own their users, persistence, workflows, and commercial quotes.

| Term                              | Meaning here                                                                                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization / API key            | A key scopes Engine resources to an organization and grants Core, DFM, and Quoting access separately. It is not an application's user or session.                                                                                                         |
| Part / job / report               | A part identifies uploaded CAD; a job is asynchronous work; a report is an immutable analysis result. Upload acceptance is not completed analysis. Keep `partId`, `jobId`/`jobUuid`, and `reportId` distinct.                                             |
| Region / feature                  | A region is a CAD surface indexed within a report. A feature interprets regions from a machining direction; several features can share a region. API `featureId` and viewer `featureTag` serve different interfaces; do not substitute one for the other. |
| Feature datasheet / DFM           | Datasheets enrich features with machining details. DFM rules assess manufacturability; the application supplies its rules and chooses how to present results.                                                                                             |
| Plan / setup / action / toolpaths | A plan describes machining intent grouped into setups and actions. Calculated toolpaths are a separate asynchronous result; their machining time is one input to a commercial quote.                                                                      |
| Material / stock                  | Material is what is cut; stock is the starting workpiece. Supported shapes and controls come from the selected API contract.                                                                                                                              |
| Tool / holder / assembly          | A tool cuts; a holder mounts it; an assembly combines them with its stickout. Parametric holders and measured holder profiles are alternative representations; see the tool-support README.                                                               |

Engine dimensions and normalized tool geometry use millimetres; surface areas use square millimetres and angles use degrees. Viewer geometry uses a Z-up frame. Read each field's units, especially feeds/speeds. A catalog's `UnitSystem` describes its source, not the units of stored geometry. Convert at explicit boundaries using `@toolpath/tool-support`'s `MM_PER_INCH`; Fusion presets must already use the export's unit system.

## Package boundaries

Read the affected package's README, manifest, and public entry points before editing. There are nine npm packages and a Python SDK; examples are not published packages.

| Directory / package                                                             | Responsibility and boundary                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui` / `@toolpath/ui`                                                  | React controls and theme. Keep application persistence, routing, and API calls out; component-specific hooks/helpers stay with their component. Imports no Toolpath sibling.                                                                          |
| `packages/app-support` / `@toolpath/app-support`                                | Shared application logic. Root imports no React; hooks/contexts use `/react`. Never imports UI.                                                                                                                                                       |
| `packages/viewer` / `@toolpath/viewer`                                          | 3D visualization; `/engine` adapts Engine reports. Keep geometry, camera, picking, and selection logic in `model/` and `render/` where possible. Applications own selection state.                                                                    |
| `packages/dfm` / `@toolpath/dfm`                                                | DFM rules/checker at React/DOM-free `/model`; React presentation at root. Ships no default rules or persistence.                                                                                                                                      |
| `packages/quoting` / `@toolpath/quoting`                                        | The quote lifecycle from the quoting app: part state, stages and moves, quote, revision and payment-page status, expiry. Plain data in, answer out; the root and `/model` are the same entry. No React, DOM, CSS or dependencies; views belong in UI. |
| `packages/tool-support` / `@toolpath/tool-support`                              | Tool/holder domain, units, and CAM exporters. No runtime/peer dependencies or external imports, including React, DOM, Node builtins, and SDK types.                                                                                                   |
| `packages/tool-drawing` / `@toolpath/tool-drawing`                              | Tool/holder drawings; React/DOM-free `/geometry`, optional `/clearance` overlay. Keep calculation/layout separate from React.                                                                                                                         |
| `packages/tool-scraper` / `@toolpath/tool-scraper`                              | Catalog ingestion. Keep filesystem/CLI behavior under `src/node/`, vendors independent, and shared core outside vendor adapters.                                                                                                                      |
| `packages/sdk-typescript` / `@toolpath/api`; `packages/sdk-python` / `toolpath` | Generated Engine clients plus maintained client/upload helpers. Both SDKs follow the same contract and release version.                                                                                                                               |

- Public imports go through declared `exports`, including documented CSS subpaths. Do not make consumers import source/private paths. New entry points also need matching source entries in `knip.json`.
- Review emitted declarations, shipped files, peer ranges, CSS assets, and runtime requirements as part of the public API. Workspace resolution alone does not prove a packed package works. Keep React and the viewer's three/R3F ecosystem as peers; do not bundle duplicate renderers.
- `pnpm knip` reports reachability, not consumer intent. Remove an internal export when appropriate; expose a type needed by a public signature through the supported entry point. Do not delete public APIs merely because this repo has no caller.
- Add runtime dependencies only with a concrete need and user approval. Keep DOM access out of server-safe entry points and Node-only imports out of browser paths.
- Scraper requests go through `packages/tool-scraper/src/fetch.ts`; preserve provenance receipts. Do not add vendors or increase scrape scope/request volume without being asked. Assert vendor CSV conventions against the adapter's actual output.
- Mastercam type codes and radius classes must agree with demonstrated reference data; do not guess unknown codes. Preserve `ExportNote` reports for coercions, skipped data, and shared-tool numbering limits. A SQLite round-trip does not prove Mastercam accepts or simulates the library correctly; see `packages/tool-support/src/export/mastercam/schema.ts`.

## Contracts and generated files

- `openapi/openapi.json` is the pinned SDK contract. `openapi/openapi.sha256` and `openapi/release.json` record its bytes and provenance; package metadata records the adopted API version/hash. SDK versions, API versions, source checkouts, and deployments are separate artifacts.
- For an intentional contract upgrade, establish the target deployment first. Stable SDKs follow the healthy production release; staging-only contracts use the staging prerelease workflow. Do not silently adopt unreleased services source or change an example's server to hide a mismatch.
- Adopt with `pnpm openapi:adopt -- /path/to/openapi.json`, then `pnpm generate`. Fix generator configuration or maintained wrappers, not `packages/sdk-typescript/src/generated/` or `packages/sdk-python/toolpath/generated/`. Review both SDKs and provenance changes together; `pnpm generate:check` regenerates files in place.
- Consult `x-toolpath-experimental`, product grants, and metering in the selected contract. Do not invent fields from a newer staging example or infer that every endpoint accepts idempotency keys. Preserve asynchronous job states, error details, and documented direct presigned uploads; never send the API key to the upload URL.
- Keep long-lived keys server-side unless an example deliberately demonstrates allowed-origin browser access. Origin restrictions do not make a browser key secret. Use placeholder credentials; do not read private `.env` files or expose keys, CAD contents, or presigned URLs in output, logs, or fixtures.
- `fusion/` and `mastercam/` hold derived schema digests/hashes. Update through `pnpm fusion:adopt -- --fetch` or `pnpm mastercam:adopt -- <reference.TOOLDB>`; never hand-edit/reformat the derived files or `schema.generated.ts`. Do not commit the private Mastercam reference database, its filename, or shop records.
- Preserve the retained bytes of `packages/viewer/fixtures/reports/`; fixtures are sanitized Engine-shaped data, not live credentials or usable URLs. Never commit build output (`dist`, caches, test reports).

## Public package releases

- Every consumer-visible package change needs a Changeset in the same PR, including manifest changes to exports, shipped files, dependencies, peers, or runtime support. Name all affected packages; summaries become customer-facing release notes. Docs/examples/CI/test-only work needs none unless it changes what consumers receive.
- Use `patch` for compatible fixes, `minor` for compatible capabilities/exports, and `major` for incompatible public types, signatures, behavior, or supported environments. Evaluate actual compatibility: widening a peer range is not inherently a breaking change. Describe breaks and migration steps explicitly.
- `packages/sdk-python`, `openapi/`, `codegen/`, and SDK generation changes use an `@toolpath/api` Changeset. Python shares its version and ships as a wheel on GitHub release `python-sdk-v<version>`, not PyPI. See [Python releases](docs/PYTHON-SDK-RELEASES.md).
- CI's [release-intent script](scripts/check-release-intent.mjs) checks selected source paths, not every consumer-visible manifest/asset change. The policy still applies outside that list. `no-release-needed` is a maintainer exemption with a written reason; never apply it to bypass a required release.
- Do not manually edit package versions or changelogs. The [release workflow](.github/workflows/release.yml) versions and publishes packages; do not publish, merge release metadata, or change npm tags without authorization. Use Actions OIDC; never add npm tokens to workflows or config. A new package's one-time manual bootstrap is the documented exception; follow [the bootstrap runbook](docs/BOOTSTRAPPING-NPM-PACKAGES.md).
- `@toolpath/api` staging prereleases use `staging`, never `latest`, and commit no stable contract/version changes. Follow `scripts/publish-sdk-prerelease.mjs` and `release.yml`; staging acceptance and stable production promotion are distinct workflows.

## Working conventions

- Prefer const arrow functions, `Array<T>`, braced multiline conditionals, and individual React imports in maintained code. Follow the package's ESM/import conventions; generated code follows its generator.
- Preserve controlled component state, focus/keyboard behavior, theme tokens, and CSS entry points. Avoid unnecessary rerenders and allocations in frame callbacks; keep expensive geometry work bounded and rendering responsive.
- Test behavior changes in the owning package, preferably through pure logic. Use `examples/react-viewer/tests/` for interactions that need a real browser/canvas and examples for consumer integration. Verify built declarations and packed artifacts when exports, dependencies, or assets change.
- Keep README examples consistent with the package's actual exports and supported peers. A local workspace version is not evidence that a capability is available in a published release.

## Commands and verification

Use the pinned toolchain in `.tool-versions` and `package.json`: Node 24, pnpm 10, Python/uv for Python checks. Published npm packages declare their own runtime floors; do not raise them to match the contributor toolchain.

| Purpose                         | Command from repo root                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Install                         | `pnpm install --frozen-lockfile`                                                                          |
| Focused package checks          | `pnpm --filter @toolpath/viewer test` / `pnpm --filter @toolpath/viewer check-types` (substitute package) |
| Full gate                       | `pnpm check`                                                                                              |
| Contract / generated SDK checks | `pnpm openapi:verify` / `pnpm generate:check`                                                             |
| CAM schema checks               | `pnpm fusion:verify` / `pnpm mastercam:verify`                                                            |
| TypeScript SDK artifact check   | `pnpm release:typescript-sdk:check`                                                                       |
| Python wheel build              | `pnpm package:python-sdk`                                                                                 |
| Add release intent              | `pnpm changeset`                                                                                          |

`pnpm check` verifies pinned contracts/digests, regenerates SDKs, lints, runs knip, builds, checks types, and tests. Docker is required for the TypeScript generator; Python generation uses pinned `openapi-python-client` through uv. `pnpm test` includes Playwright, the UI tarball check, and release-script checks; Chromium must be installed. CI also builds the Python wheel. The TypeScript SDK artifact check is separate from `pnpm check`; run it for SDK packaging changes.

Run focused checks first, then `pnpm check` for consumer-visible work. For instruction/docs-only work, validate formatting, links, and stated commands without regenerating packages. Report checks as passed, failed, or skipped with reasons; missing Docker/Chromium is a prerequisite failure, never a pass. Formatting comes from Prettier via the pre-commit hook; avoid whole-repo formatting. Never bypass hooks or weaken checks to get a passing result.

## Documentation and sources

| Task                              | Start here                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package usage and public exports  | `packages/<name>/README.md`, its `package.json`, and exported source entries                                                                                                         |
| API routes, shapes, units, access | Pinned [OpenAPI](openapi/openapi.json) for SDK work; [public developer guides](https://developers.toolpath.com/) and the target server's `/v1/openapi.json` for deployment questions |
| Viewer data and geometry behavior | [Fixture notes](packages/viewer/fixtures/README.md), `packages/viewer/src/{engine,model,render}/`, and package tests                                                                 |
| UI/theme integration              | [UI README](packages/ui/README.md), `packages/ui/theme.css`, component source, and theme/packaging tests                                                                             |
| Tool/holder and CAM semantics     | [Tool support](packages/tool-support/README.md), exporter source/tests, `fusion/`, and `mastercam/`                                                                                  |
| CI, packaging, and publishing     | `package.json`, `.github/workflows/`, `scripts/`, [Python releases](docs/PYTHON-SDK-RELEASES.md), and [new npm packages](docs/BOOTSTRAPPING-NPM-PACKAGES.md)                         |

Historical plans in `docs/` do not override the current code, manifest, contract, or release workflow. Keep private services/kernel implementation details upstream; public packages consume the published API contract.
