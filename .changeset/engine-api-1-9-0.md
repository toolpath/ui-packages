---
'@toolpath/api': minor
---

Regenerate the TypeScript SDK for Engine API 1.9.0 (from 1.8.0).

Temporary sessions without an API key.

- `demo.createDemoSession` (`POST /v1/demo/session`) is public: it takes no `Authorization`
  header and answers `201` with a `DemoSessionResponse` — a short-lived `apiKey`, its `expiresAt`,
  and the `orgId` of the throwaway organization its uploads are isolated to. Pass a stable
  `installId` (a UUID the caller keeps per install) in `DemoSessionRequest` to renew: the previous
  key is retired and a new one is issued on the same organization. Omit it for a fresh
  organization each time.
- It answers `429 demo_ip_limit` with a `Retry-After` header when too many sessions are live
  for the caller's network, and `503 demo_session_unavailable` when the session service is down.
- A session key may call only the operations on the server's allowlist; any other is refused with
  `403 demo_endpoint_forbidden`. The key itself is valid, so retrying is pointless. It is also
  granted the core API only, so a metered operation is refused `403 product_mismatch` first.
- New components: `DemoSessionRequest` and `DemoSessionResponse`.

`createToolpathClient` gains two namespaces: `demo` (above) and `holders`, which exposes the
existing `HoldersApi` (`createHolder`, `getHolder`, `updateHolder`, `downloadHolderFusion`,
`exportFusionHolderLibrary`) that was generated but not reachable from the client. `apiKey` may now
be `''` for a client that only calls public operations.
