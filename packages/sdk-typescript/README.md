# Toolpath TypeScript SDK

`@toolpath/api` provides TypeScript bindings for the Toolpath Engine API, with helpers to upload a part
and to wait for a job.

## Install

```bash
npm install @toolpath/api
```

The package is ES modules only. A resolver that asks for `require` rather than `import` gets the same
files through the `default` condition, but a plain Node `require()` of them needs Node 20.19+ or
22.12+; earlier Node uses `import`.

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
it resolves with the job when it succeeds, and rejects with a `JobFailedError` carrying the job when
it fails. Every job reaches one of the two, so the one stream is enough. It rejects if the stream
ends first: the connection was lost, or the server closed the stream because the job expired or was
deleted, or because it could not read the job. Opening it once more is safe, since a new stream
starts with the job as it is now, and `client.jobs.getJob()` says which it was. An error response
rejects with `ResponseError`, whose `response` still holds the problem details. `onUpdate` receives
every job the stream sends, and an `AbortSignal` passed as `signal` stops waiting.

Pass `reconnect` to have it open the stream again itself instead: when the stream ends early, when
the connection fails, and on a 429, after its `Retry-After`, or a 5xx. Other error responses still
reject at once, since a refused key (401, 403) or an unreachable job (404, 410) will not change by
asking again. `reconnect: true` waits 1, 2, 4, then every 8 seconds between streams, starting over
after a stream that sent the job; `{ delaysMs, giveUpAfterMs }` sets the waits and gives up once
reconnecting has failed for that long, after one last attempt. A 429 or 503 whose `Retry-After`
falls past that time rejects at once instead. A quiet job on an open stream does not count against
it.

```ts
const job = await waitForJob(client, jobId, { reconnect: { giveUpAfterMs: 10 * 60_000 }, signal })
```

`reconnect` takes four more options, all off by default:

- `jitter`, a fraction from 0 to 1, varies each wait by up to that much, so streams lost
  together do not reconnect together. A delay may shrink or grow by it; a `Retry-After` wait only
  grows, so it is spread too but never shorter than the server asked.
- `stableMs` starts the delays over only after a stream that stayed open that long, rather than
  after any stream that sent the job, so a stream that opens and drops at once still backs off.
- `quietMs` treats a stream that has sent nothing for that long, keep-alives included, as lost,
  and opens another. The server sends a keep-alive every 15 seconds; 45 seconds is a sensible value.
- `lookOnLoss` reads the job once with `getJob` when a stream ends or is lost early. A final job
  settles the wait. A 401, 403, 404, 410 or any other 4xx but a 429 rejects, while a 429, a 5xx or
  a failed connection goes on reconnecting, waiting the look's `Retry-After` where it is longer than
  the next delay.

A `jitter` outside 0 to 1, or not finite, rejects with a `RangeError` before any request.

The first argument may also be a function that returns the client, called before each stream and
each look, so a long wait can change its key. A refused key (401, 403) still rejects; whether to
wait again with another key is the caller's choice. An error the function throws, or a rejection,
ends the wait at once and is not retried, and a pending call sees `signal` only once it settles.
Return a client kept per key rather than a new one each call.

`onStream` is told `'open'` each time a stream's response arrives and, with `reconnect`, `'lost'`
when an open stream ends, drops or goes quiet before the job is final, before any look and the
wait to reconnect. Between the two no stream is listening. It is not called for a stream that
could not be opened, nor when the wait settles or aborts.

### A server that watches many jobs

A server that keeps a wait open for every job it is watching should use all four, so that streams
dropped together, by a deploy or a network blip, do not reconnect in step, a stream that flaps is
backed off, a connection that dies silently is noticed, and a job that finished meanwhile is
settled without another stream:

```ts
// One client per key, made once: the function is called before every stream and look.
const clients = new Map<string, ToolpathClient>()
const clientFor = (apiKey: string): ToolpathClient => {
  let client = clients.get(apiKey)
  if (!client) {
    client = createToolpathClient({ apiKey })
    clients.set(apiKey, client)
  }
  return client
}

const job = await waitForJob(() => clientFor(currentApiKey()), jobId, {
  reconnect: { jitter: 0.2, stableMs: 30_000, quietMs: 45_000, lookOnLoss: true },
  signal,
})
```

The generated `client.jobs.streamJobEvents()` is not a substitute: it resolves only once the stream
has closed, with the raw event text.

The SDK exports generated request, response, and API types from the Toolpath OpenAPI contract. See the
[API documentation](https://developers.toolpath.com) for a complete analysis flow.

## License

MIT
