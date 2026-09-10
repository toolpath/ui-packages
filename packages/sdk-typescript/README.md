# Toolpath TypeScript SDK

`@toolpath/api` provides TypeScript bindings and an upload helper for the Toolpath Engine API.

## Install

```bash
npm install @toolpath/api
```

Create an API key in the [Toolpath portal](https://portal.toolpath.com/api-keys), then create a client:

```ts
import { createToolpathClient, uploadToPresignedUrl } from '@toolpath/api'

const client = createToolpathClient({ apiKey: process.env.TOOLPATH_API_KEY! })
const part = await client.parts.createPart({ filename: 'bracket.step' })

await uploadToPresignedUrl(part.uploadUrl, stepFileBytes)
const analysis = await client.parts.updatePart({ id: part.partId })
```

A client with no key can still start a temporary session. The key it returns is limited to a
short allowlist of operations and expires; send the same `installId` to renew it on the same
organization:

```ts
const session = await createToolpathClient({ apiKey: '' }).demo.createDemoSession({
  demoSessionRequest: { installId },
})
const client = createToolpathClient({ apiKey: session.apiKey })
```

The SDK exports generated request, response, and API types from the Toolpath OpenAPI contract. See the
[TypeScript example](../../examples/typescript) and [API documentation](https://developers.toolpath.com)
for a complete analysis flow.

## License

MIT
