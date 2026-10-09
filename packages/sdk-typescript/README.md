# Toolpath TypeScript SDK

`@toolpath/api` provides TypeScript bindings for the Toolpath Engine API, with helpers to upload a part
and to wait for a job.

## Install

```bash
npm install @toolpath/api
```

Create an API key in the [Toolpath portal](https://portal.toolpath.com/api-keys), then create a client:

```ts
import { createToolpathClient, uploadToPresignedUrl, waitForJob } from '@toolpath/api'

const client = createToolpathClient({ apiKey: process.env.TOOLPATH_API_KEY! })
const part = await client.parts.createPart({ filename: 'bracket.step' })

await uploadToPresignedUrl(part.uploadUrl, stepFileBytes)
const analysis = await client.parts.updatePart({ id: part.partId })
await waitForJob(client, analysis.jobId, {
  onUpdate: (job) => console.log(job.status, job.progress),
})
const report = await client.parts.getPart({ id: part.partId, jobId: analysis.jobId })
```

## Waiting for a job

Every operation that queues work returns a `jobId`. Wait for it with `waitForJob`, not by calling
`client.jobs.getJob()` in a loop. It follows the job's event stream (`GET /v1/jobs/{id}/events`):
it resolves with the job when it succeeds, rejects with a `JobFailedError` carrying the job when it
fails, and reopens the stream if the server closes it first. `onUpdate` receives every job the
stream sends, and an `AbortSignal` passed as `signal` stops waiting.

The generated `client.jobs.streamJobEvents()` is not a substitute: it resolves only once the stream
has closed, with the raw event text.

The SDK exports generated request, response, and API types from the Toolpath OpenAPI contract. See the
[TypeScript example](../../examples/typescript) and [API documentation](https://developers.toolpath.com)
for a complete analysis flow.

## License

MIT
