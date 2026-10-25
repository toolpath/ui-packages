# Toolpath Engine integration context

Optional context for repositories that integrate the Toolpath Engine API. It defines concepts and integration patterns; the selected contract defines routes, fields, enums, requiredness, and experimental status. The repository's own instructions come first and specialize this context.

## Domain model and terminology

Toolpath helps a shop answer: **Can I make this part with my tools? How will I make it? What will it cost?** The Engine API supplies manufacturing analysis and machining information. An application owns its product workflow, users, persistence, customer experience, and commercial quotes.

| Term                                 | Meaning and relationships                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization / API key               | A Bearer key scopes Engine resources to an organization. It is not an application's user, session, or tenant record.                                                                                                                                                                      |
| Product access                       | A key holds read and write access separately for `core` (uploads, part display, holders, jobs), `dfm` (analysis, feature datasheets, plans), and `quoting` (toolpaths, machining time). Each operation names its area in `x-toolpath-product`; `GET` reads and every other method writes. |
| Metering                             | `x-toolpath-metered` marks billed operations. A metered write can return 402 when the organization's quota, credits, or spend limit is exhausted.                                                                                                                                         |
| Part / `partId`                      | The resource analyzed for manufacturing. Creating a part returns an upload URL; it does not mean the part is uploaded or analyzed.                                                                                                                                                        |
| File / `fileId`                      | Only in contracts with the experimental Files API: an uploaded CAD file inspected into indexed solid bodies. Bodies take the role `part`, `stock`, or `ignore`, and each `part` body becomes an ordinary part. Keep `fileId`, body `index`, and `partId` distinct.                        |
| Job                                  | Asynchronous work with status `queued`, `running`, `succeeded`, or `failed`, plus `progress` and `error`. Queue responses call its identifier `jobId`; job resources call it `jobUuid`. Map the fields deliberately.                                                                      |
| Part result / `reportId`             | The immutable analysis result a succeeded job produced: regions, features, directions, and artifact references. A part can be analyzed again, so keep the result identity when attaching app-owned annotations.                                                                           |
| Region / `idx`                       | A recognized CAD surface with its area and triangle range. An index is meaningful within its result, not a global database ID.                                                                                                                                                            |
| Feature / `featureId` / `featureTag` | A machining interpretation of regions from a direction; several features can share a region. `featureId` identifies the record within its result; `featureTag` is stable across runs of one kernel version only. Plan actions refer to features by tag.                                   |
| Machining direction                  | A direction a machining operation can approach the part from. Direction-dependent features can describe the same surfaces differently.                                                                                                                                                    |
| Feature datasheet                    | Detailed machining data for a recognized feature, produced only when requested. Do not assume every feature carries every datasheet field.                                                                                                                                                |
| DFM                                  | Design for manufacturability: whether and how geometry can be made. The application chooses its rules and how to present them.                                                                                                                                                            |
| Plan / `planId`                      | A machining plan for an analyzed part: setups, actions, coverage issues, material, and stock. It is distinct from the analysis and from calculated toolpaths.                                                                                                                             |
| Setup / action                       | A setup groups work from one machining direction; its actions state machining intent and the tools they use. Positions within a plan are not identities in other endpoints.                                                                                                               |
| Toolpaths / machining time           | Calculated asynchronously for a plan. Machining time is one input to a price, not the price: an application adds setup, material, labor, margin, and its own commercial rules.                                                                                                            |
| Material / stock / tool / holder     | Material is what is cut; stock is the starting workpiece; a tool cuts and a holder mounts it, with its own resource and job flow. Supported shapes, modes, and controls differ by contract version.                                                                                       |
| Experimental surface                 | Operations, fields, and schemas marked `x-toolpath-experimental` can change in a minor release. Read the release notes before upgrading and do not promise stable compatibility for them.                                                                                                 |

Lengths are millimetres, surface areas square millimetres, and angles degrees; part results state this in their `units` field. Machining-time fields name their unit (`…Seconds`). Read each schema's units: vectors, normalized values, rates, and counts are not lengths. Convert at an explicit presentation boundary; never reinterpret a payload because the interface shows inches.

## Contracts, SDKs, and deployments

A deployment, the contract it serves, and the SDK generated from a contract are separate artifacts; none upgrades another. Reviewed 2026-10-24:

| Channel | TypeScript SDK                                                         | Contract | Deployment                         |
| ------- | ---------------------------------------------------------------------- | -------- | ---------------------------------- |
| Stable  | `@toolpath/api@0.9.0` (npm `latest`)                                   | `1.29.1` | `https://api.toolpath.com`         |
| Staging | `@toolpath/api@0.10.0-staging.20261024220030.gb8be413` (npm `staging`) | `1.32.0` | `https://api.staging.toolpath.com` |

- Each deployment serves its contract at `/v1/openapi.json`. An installed SDK records the contract it was generated from in its `package.json` (`toolpath.openApiVersion` and `toolpath.openApiSha256`).
- `createToolpathClient({ apiKey, baseUrl, fetch })` defaults `baseUrl` to production. Installing a staging SDK does not select the staging server, and the staging contract's own `servers` entry still names production, so pass the staging base URL explicitly.
- A staging integration is an explicit exact prerelease SDK plus an explicit staging base URL. Upgrading the SDK, changing its pin, or redirecting the backend is a deliberate change, never a way to make a check pass.
- Resolve the environment before the shape: identify the intended server from the repository's instructions, non-secret configuration, and installed SDK metadata, then check operation IDs, required fields, access, asynchronous responses, and experimental markings against that server's contract. Report when the contract is unavailable rather than inventing a payload from an old example.

## Integration patterns

### Credentials and access

- Keep long-lived keys on a server behind an application-owned API boundary. A browser integration is supported only through deliberate per-key allowed origins and limited access: a key in client code is readable by anyone, and origin restrictions do not make it secret. Prefer a read-only key there; its writes are refused with 403 `read_only_key`.
- Distinguish 401 (missing or invalid key), 403 `product_mismatch` (no access to the operation's area), and 403 `read_only_key`. Retrying unchanged credentials does not repair access.
- Never put keys, upload URLs, or artifact URLs in chat, logs, analytics, source, or committed fixtures. Use placeholder credentials in examples.

### Uploads and artifacts

- Create the part (or file), then upload the CAD bytes directly to the returned short-lived `uploadUrl` with the SDK's `uploadToPresignedUrl`. The upload goes to object storage: never send the Engine API key to the upload host. The `filename` extension selects the CAD reader, so it must match the bytes sent.
- Artifact URLs in results (`thumbnailUrl`, `meshStlUrl`, `meshGlbUrl`) last 15 minutes. Persist permanent identifiers, never URLs, and fetch a fresh URL by reading the owning resource again. Proxy artifact reads when the application keeps upstream URLs out of the browser.
- A resource past the retention window returns 410; treat it as gone rather than retrying.

### Asynchronous jobs

- An accepted job is not a completed result. Present queued, running, failed, and succeeded states explicitly, and read the result from the matching endpoint only after `succeeded`.
- Prefer the job event stream (`GET /v1/jobs/{id}/events`), which sends the current job and then each change. After a dropped connection, reconnect and accept the fresh snapshot. Poll `GET /v1/jobs/{id}` with a bound only where streaming is unavailable.

### Errors, retries, and idempotency

- Error responses are problem details with a stable `code`. Preserve the status, code, and useful request identifiers at the application boundary without exposing credentials.
- Distinguish an API refusal from a transport failure where no answer arrived. Before repeating a write, check that operation's idempotency support: only some writes accept an `Idempotency-Key`, and reusing a key for a different operation is refused with 409. A blind retry of a metered write can duplicate work and charges.

### Application-owned data

- Keep persistence entities and business models in the application; store Engine identifiers (`partId`, job identifiers, `reportId`, `planId`) beside them and return app-owned DTOs to clients.
- Keep domain calculations in pure modules, and keep Engine calls in an integration module the application owns.

### SDK ownership and compatibility modules

- Use the public SDK's exports for client methods, authentication, uploads, and event streams. A deficiency in them belongs in the SDK as an upstream change, not in a parallel client, a hand-edited generated file, or an import of a private SDK path.
- Type-only imports of SDK models are fine anywhere. Runtime SDK construction and calls belong in the modules listed in `dev.config.mjs` `engine.integrationFiles`; the `toolpath-engine/no-direct-engine-http` lint rule rejects identifiable direct `fetch` calls to a configured Engine origin elsewhere.
- Deliberate raw HTTP, such as an unpublished or staging-only operation during feature development, lives in a declared `engine.compatibilityFiles` module with its reason and behavioral tests. Prefer a matching published staging SDK once it supports the operation.

### Testing Engine integrations

- `@toolpath/dev-config/engine/testing` provides deterministic scenarios on the pinned public contracts (`api-1.29.1`, `api-1.32.0`) behind the real SDK: an injected `fetch` for unit tests, `/engine/testing/node` for a real local HTTP server, and `/engine/testing/msw` for MSW. See `node_modules/@toolpath/dev-config/docs/engine-testing.md`.
- Test refused access, job failures, expired artifacts, interrupted event streams, and contract/SDK mismatches where the application handles them. Fixture tests prove client compatibility, not a live service: keep real integration checks for behavior that depends on the deployed Engine.

## Documentation and sources

| Need                                              | Authoritative public starting point                                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| First integration                                 | [Quick start](https://developers.toolpath.com/quick-start)                                                                                            |
| Keys, product access, browser origins             | [Authentication](https://developers.toolpath.com/authentication)                                                                                      |
| Installing the TypeScript SDK                     | [SDK installation](https://developers.toolpath.com/sdk-installation)                                                                                  |
| Upload and processing examples, CAD formats       | [SDK examples](https://developers.toolpath.com/sdk-examples)                                                                                          |
| Exact routes, payloads, units, experimental flags | The target deployment's contract: [production](https://api.toolpath.com/v1/openapi.json), [staging](https://api.staging.toolpath.com/v1/openapi.json) |
| Reference documentation and release notes         | [Developer documentation](https://developers.toolpath.com/)                                                                                           |

Read an installed package's README, exports, and version before coding against it; a newer source checkout is not evidence that a capability is published. Names in an application's own source, legacy internal code, and architecture proposals do not establish the current public contract.
