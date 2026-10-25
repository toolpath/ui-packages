# Engine API testing

`@toolpath/dev-config/engine/testing` runs the **real public `@toolpath/api` SDK** against a deterministic, contract-validated simulation of the Engine API and its presigned storage host. It is a test double for the network boundary, not an API client: the SDK owns requests, authentication, uploads, event streams, pagination and retries. Nothing here parses server-sent events, reconnects, or retries on a consumer's behalf.

Select it with the `engine` profile in `dev.config.mjs` (see [configuration](configuration.md)); generic consumers never load it.

| Entry point                                | Use                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `@toolpath/dev-config/engine/testing`      | Scenarios, fixtures, the injected-fetch transport, request records. The default for unit tests. |
| `@toolpath/dev-config/engine/testing/node` | `startEngineTestServer`: the same scenario over real HTTP on an ephemeral loopback port.        |
| `@toolpath/dev-config/engine/testing/msw`  | `createEngineHandlers`: the same scenario as MSW handlers (MSW is an optional peer).            |
| `@toolpath/dev-config/engine/eslint`       | The optional `toolpath-engine/no-direct-engine-http` rule, applied by `createEslintConfig`.     |

The test kit runs in Node, including Vitest's jsdom environment. It reads its contract snapshots from disk, so it does not run in a real browser.

## Contracts and SDK artifacts

Ordinary tests are offline: they read immutable snapshots shipped in the package and never fetch a contract or look up a dist-tag.

| Contract ID  | Channel at pinning | SDK artifact                                           | OpenAPI SHA-256                                                    |
| ------------ | ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------ |
| `api-1.29.1` | stable             | `@toolpath/api@0.9.0`                                  | `123854eecdb1ee00468d573654e9a307e1d4764f183f4b3047a693c8fafb4a3c` |
| `api-1.32.0` | staging            | `@toolpath/api@0.10.0-staging.20261024220030.gb8be413` | `b21fe6b647ad5f4274f7650b838b0482d03010b9b89844e485ceb974adeb8c68` |

Each snapshot sits in `contracts/engine/<id>/openapi.json` with a `provenance.json` naming where its bytes came from. They are reproducibility inputs, not claims about what any deployment serves now. A snapshot whose bytes do not match its pinned hash is rejected when a scenario is created.

An SDK and a server are separate choices. Installing a staging SDK does not point it at staging, because `createToolpathClient` defaults to `https://api.toolpath.com`. A staging test passes the staging contract, the staging base URL to the scenario, and the same base URL to the client. A scenario checks the installed SDK version against its contract and fails at creation on a mismatch. Pass `sdkVersion` when the SDK under test is not the `@toolpath/api` installed where the tests run.

```ts
const scenario = createEngineScenario({
  contract: 'api-1.32.0',
  baseUrl: 'https://api.staging.toolpath.com',
})
const client = createToolpathClient({
  apiKey: TEST_API_KEY,
  baseUrl: 'https://api.staging.toolpath.com',
  fetch: createEngineFetch(scenario),
})
```

### Verifying a live target

`toolpath-dev engine verify-contract` is the one command that uses the network. It reads a target's public `/v1/openapi.json`, with no credentials sent. It then compares that contract with the installed SDK's recorded `toolpath.openApiSha256`/`openApiVersion` and with the selected snapshot. It reports mismatches and changes nothing: it does not switch environments, change pins, or regenerate the SDK. It is never part of `check` or `ci`.

```sh
toolpath-dev engine verify-contract --target staging --contract api-1.32.0
toolpath-dev engine verify-contract                # production; contract from dev.config.mjs or the installed SDK
```

Exit codes: `0` everything agrees, `1` a mismatch, `2` an invalid invocation or an unreachable target.

## A first test

```ts
import { createToolpathClient, uploadToPresignedUrl } from '@toolpath/api'
import {
  TEST_API_KEY,
  createEngineFetch,
  createEngineScenario,
} from '@toolpath/dev-config/engine/testing'
import { expect, it } from 'vitest'

it('shows a finished analysis', async () => {
  const scenario = createEngineScenario()
  const fetch = createEngineFetch(scenario)
  const client = createToolpathClient({ apiKey: TEST_API_KEY, fetch })

  const part = await client.parts.createPart({ filename: 'bracket.step' })
  await uploadToPresignedUrl(part.uploadUrl, new Uint8Array([1, 2, 3]), { fetch })
  const { jobId } = await client.parts.updatePart({ id: part.partId })

  scenario.advanceJob(jobId, { status: 'running', progress: 50 })
  scenario.advanceJob(jobId, 'succeeded')

  const result = await client.parts.getPart({ id: part.partId })
  expect(result.jobId).toBe(jobId)
  expect(scenario.violations).toEqual([])
})
```

The presigned upload is a direct `PUT` to the synthetic storage host. It must not carry the Engine API key: an upload with an `Authorization` header is refused and recorded as a violation.

### Over real HTTP or MSW

```ts
const server = await startEngineTestServer(scenario) // node:http on 127.0.0.1:<ephemeral>
const client = createToolpathClient({ apiKey: TEST_API_KEY, baseUrl: server.url })
// … await server.close()

const msw = setupServer(...createEngineHandlers(scenario))
msw.listen({ onUnhandledRequest: 'error' })
```

All three adapters hand requests to one dispatcher, so state transitions, responses and failures are identical. A request the scenario rejects, or a simulated network failure, never gets a contract response. The injected fetch rejects with an `EngineScenarioError`. The server drops the connection. MSW answers with a network error. In every case the diagnostic is in `scenario.violations`.

## Scenario options

| Option          | Default                               | Meaning                                                                                                                                                                                                   |
| --------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract`      | `api-1.29.1`                          | One of the pinned contract IDs.                                                                                                                                                                           |
| `seed`          | `toolpath-dev-config`                 | Seeds every identifier and URL signature, so a scenario issues the same values in the same order on every run.                                                                                            |
| `now`           | always `2026-01-01T00:00:00.000Z`     | The scenario's clock: job timestamps and presigned URL expiry. Inject your own function to move time.                                                                                                     |
| `latency`       | `0`                                   | Milliseconds before a request is handled, globally or per operation ID. Zero schedules no timer. Delays use `setTimeout`, so `vi.useFakeTimers()` controls them. An abort during a delay changes nothing. |
| `state`         | one full-access key, no resources     | Test-owned API keys, parts, jobs and reports, validated against the contract and against each other.                                                                                                      |
| `baseUrl`       | `https://api.toolpath.com`            | The Engine API base URL the injected fetch and MSW handlers serve. Requests for other hosts are violations; there is no fallback to the network.                                                          |
| `storageOrigin` | `https://storage.engine.test`         | The synthetic presigned host. `.test` never resolves on a real network.                                                                                                                                   |
| `sdkVersion`    | the installed `@toolpath/api`, if any | The SDK artifact under test, checked against `contract`.                                                                                                                                                  |

## Controls

- **`advanceJob(jobId, transition)`.** Moves a job explicitly; no timer ever completes one. The allowed moves are `queued → running | failed`, `running → running (progress) | succeeded | failed`. A terminal job does not change. `succeeded` creates the report (override its fields with `{ status: 'succeeded', report: {...} }`); `failed` sets `error`. The call returns the job as the API now serves it.
- **`failNext(operationId, failure)`.** A one-shot failure for the next call of one operation. `{ status }` must be an error status that operation documents as a problem response in the selected contract, so a status it does not document is refused. `{ network: true }` drops the request with no response. `{ malformedBody: true }` returns a success status whose body is not JSON, for client-robustness tests only. `presignedUpload` and `artifactDownload` name the storage host's two requests.
- **`requests`.** Every request in arrival order, sanitized. Each record holds `sequence`, `target` (`api` or `storage`), `operationId` (or `unmatched`), method, origin, path, and query, with signatures and tokens redacted. It also holds the parsed JSON body (an upload records only its size), the headers with `authorization`, `cookie` and API-key headers redacted, the `caller` (an API key's label, `unknown`, or `none`), and the `idempotencyKey`. Credentials and CAD bytes are never recorded.
- **`violations`.** Test-kit diagnostics: unmatched paths or methods, operations the scenario does not simulate, requests for other hosts, requests after `close()`, and an API key sent to the upload host. Assert it is empty in tests that should be clean.
- **`endJobStreams(jobId?)` / `interruptJobStreams(jobId?)`.** End event streams normally, or break them mid-response the way a dropped connection does.
- **`reset()`.** Returns to the original seed, clock-derived state and resources. It clears pending failures, records and violations, and ends open streams.
- **`close()`.** Ends every stream; later requests are violations. It is safe to call twice. `startEngineTestServer(...).close()` is awaited separately.
- **`part(id)`, `job(id)`, `report(id)`.** Copies of the current state, for assertions.

## What the scenario simulates

The common upload-and-analysis journey, validated against the selected contract in both directions. Request parameters and JSON bodies are checked against the operation's declared schemas: a malformed request, or a query parameter the contract does not define, gets `400 invalid_request`. Every response the scenario builds is validated against the operation's declared schema for its status and content type, with Ajv's JSON Schema 2020-12 build on JSON wire values (timestamps are strings, not the SDK's `Date` objects).

| Operation            | Behaviour                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateKey`        | `200`/`401` with the key's status.                                                                                                                            |
| `createPart`         | A part and a signed 15-minute upload URL on the storage host.                                                                                                 |
| `updatePart`         | `409` until the source is uploaded; then a queued `analyze-part` job. Honors `Idempotency-Key`; added `directions` persist on the part (at most 12).          |
| `getJob`, `listJobs` | The job; the job list newest first, filtered by `partId`, `holderId` and `status`, paged (`pageSize` capped at 100).                                          |
| `streamJobEvents`    | `text/event-stream`: the current job immediately, then one `event: job` per change, each `data:` the JobDetail JSON (`formatJobEvent` gives the exact bytes). |
| `getPart`            | `404` until an analysis succeeds; the latest result (or the one `jobId` names), with freshly signed 15-minute artifact URLs.                                  |
| `getPartThumbnail`   | A deterministic PNG.                                                                                                                                          |

Every secured operation checks the bearer key and its per-product grant (`x-toolpath-product`; `GET` reads, every other method writes). A missing, unknown, revoked or expired key gets `401 invalid_api_key`; no access to the product gets `403 product_mismatch`; a write with read access gets `403 read_only_key`. These three codes are the ones the contracts name. The other default codes (`not_found`, `source_not_uploaded`, `idempotency_conflict`, `invalid_request`, …) are placeholders that a test can override with `failNext` and `createProblemFixture`.

Artifacts are deterministic stand-ins: a 1×1 PNG, an empty STL and a minimal GLB. A URL past its expiry on the scenario clock gets `403 Request has expired` from the storage host. A fresh URL comes from the owning endpoint (`getPart` again).

Any other operation in the contract fails as a violation: the scenario does not pretend to serve it. Compose your own handlers outside the strict Engine transport for anything else.

Rate limiting: the only documented `429` in either contract is `createDemoSession`, and neither contract documents `Retry-After` or rate-limit headers, so the scenario serves `failNext('createDemoSession', { status: 429 })` and invents no retry metadata.

### Staging-only capabilities

With `contract: 'api-1.32.0'`, jobs and job summaries carry the required `fileUuid` (null for part jobs). A failed analysis may list `bodies` (`advanceJob(id, { status: 'failed', error: 'multiple_bodies: …', bodies })`). `createPart` accepts `bodyIndex`, which the part's result reports. Each of these is validated against the staging contract and refused for `api-1.29.1`, whose schemas do not define them. The experimental Files API is not simulated.

## Fixtures

`createPartFixture`, `createJobFixture`, `createReportFixture`, `createProblemFixture` and `createApiKeyFixture` build wire values: what travels in JSON, not what the SDK deserializes. Their types derive from the SDK's public models with `Wire<T>` (each `Date` becomes an ISO string). `JobFixture` is `Wire<JobDetail>`. `ReportFixture` is `Wire<PartResponse>`, because the Engine's immutable part result (`reportId`) is the `PartResponse` model. The SDK's own deserializers accept them (`JobDetailFromJSON(createJobFixture())`). The builders take `contract` (staging fields only for `api-1.32.0`) and `index`, which pairs default identifiers: `createJobFixture({ index: 2 })` belongs to `createPartFixture({ index: 2 })` and names `createReportFixture({ index: 2 })`. A non-null artifact URL on a report fixture marks that artifact present; the scenario serves its own signed URL in its place.

Keep identities distinct: `partId`, `jobId`/`jobUuid` and `reportId` are different values, and the state validator rejects a report whose job names a different report or part.

## `toolpath-engine/no-direct-engine-http`

With `engine` selected, `createEslintConfig` keeps runtime SDK use in `engine.integrationFiles`. Type-only `@toolpath/api` imports are fine anywhere, and its internal paths are restricted everywhere. The rule also reports a `fetch` that statically targets a configured Engine origin outside the integration and compatibility files. `engine.compatibilityFiles`, each with its reason, are where deliberate raw HTTP lives, for example an unpublished staging endpoint. They are a supported mechanism and need behavioral tests.

The rule's detection boundary, exactly:

- **Reported:** the global `fetch`, `globalThis.fetch`, `window.fetch` or `self.fetch`, or a `const` alias of one (`const send = fetch`, `const { fetch: send } = globalThis`, `fetch.bind(globalThis)`). It must be called with a URL whose origin is statically known: a string or template literal, `+` concatenation, a `const` binding, `new URL(input, base)`, `new Request(url)`, `.href`/`.url`/`.toString()`. A template whose computed part comes after the authority (`` `${ENGINE}/v1/parts/${id}` ``) counts, as does a relative path against a known base (``new URL(`/v1/jobs/${id}`, ENGINE)``).
- **Not reported:** relative routes (`/v1/...`) to an application's own server or proxy; presigned storage hosts and application endpoints; URLs computed at run time, function parameters, `let` bindings; an origin followed directly by computed text (`` `https://api.toolpath.com${suffix}` `` could continue the host name); a shadowed or injected `fetch` (a parameter, a local function); `fetch` methods on other objects; other HTTP clients.

A linter cannot tell which deployment a run-time URL reaches, whether a staging dist-tag contains an endpoint, or whether every call goes through the SDK. Dynamic cases remain review concerns. Prefer a published staging SDK that supports the needed contract over raw HTTP. Do not upgrade an application's SDK or redirect its backend merely to satisfy the rule.

## Limits

- Contract smoke tests prove that the SDK, the fixtures and the pinned contract agree. They do not prove a live Engine service behaves this way. Applications with real service behavior keep their own required integration checks against a real deployment.
- A request outside the simulated surface is a violation rather than a guess. Tests that need more operations compose their own handlers outside this transport.
- With MSW, a client-side `cancel()` on an open mocked event stream does not reach the scenario. End the stream with `endJobStreams` or abort the request's signal.
- Job progress, timing and artifact contents are test inputs, not realistic analysis output. Fixtures use tiny synthetic data and placeholder keys, never real CAD, presigned URLs or credentials.
