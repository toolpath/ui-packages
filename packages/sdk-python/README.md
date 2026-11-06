# Toolpath Python SDK

`toolpath` provides generated Python bindings for the Toolpath Engine API, with helpers to upload a part
and to wait for a job.

Each version is a wheel on a GitHub release of this repository, tagged `python-sdk-v<version>`.
Install it from that release's URL:

```bash
uv add "toolpath @ https://github.com/toolpath/ui-packages/releases/download/python-sdk-v0.8.1/toolpath-0.8.1-py3-none-any.whl"
# or
pip install https://github.com/toolpath/ui-packages/releases/download/python-sdk-v0.8.1/toolpath-0.8.1-py3-none-any.whl
```

Its version matches the `@toolpath/api` TypeScript SDK built from the same API contract. See the
[releases](https://github.com/toolpath/ui-packages/releases) for the newest `python-sdk-v` tag.
The repository is public, so the download needs no sign-in. The SDK is not on PyPI.

Create an API key in the [Toolpath portal](https://portal.toolpath.com/api-keys). See the
[API documentation](https://developers.toolpath.com) for a complete part-analysis flow.

## Waiting for a job

Every operation that queues work returns a `job_id`. Wait for it with `wait_for_job`, not by calling
`get_job` in a loop. It follows the job's event stream (`GET /v1/jobs/{id}/events`), returns the job
when it succeeds, and raises `JobFailedError` carrying the job when it fails:

```python
from toolpath import AuthenticatedClient, wait_for_job

client = AuthenticatedClient("https://api.toolpath.com", token=api_key)
job = await wait_for_job(client, job_id, on_update=lambda job: print(job.status, job.progress))
```

Every job reaches one of the two, so the one stream is enough. The stream ending first raises
`RuntimeError`. The server closes it early when the job expired or was deleted while it waited, or
when it could not read the job, and reading it can raise an `httpx.TransportError` — a reset or
dropped connection, or nothing received for 60 seconds — which becomes the `RuntimeError`'s
`__cause__`. Calling `wait_for_job` once more is safe, since a new stream starts with the job as it
is now, and `get_job` says which it was. Errors before the stream opens are httpx's own: `httpx.HTTPStatusError` for an error
response, and `httpx.TransportError` when no response arrives.

Pass `reconnect` to have it open the stream again itself instead: when the stream ends early, when
the connection fails, and on a 429, after its `Retry-After`, or a 5xx. Other error responses still
raise at once, since a refused key (401, 403) or an unreachable job (404, 410) will not change by
asking again. `reconnect=True` waits 1, 2, 4, then every 8 seconds between streams, starting over
after a stream that sent the job; `WaitForJobReconnect(delays=..., give_up_after=...)` sets the
waits, in seconds, and gives up once reconnecting has failed for that long, after one last attempt.
A 429 or 503 whose `Retry-After` falls past that time raises at once instead. A quiet job on an open
stream does not count against it.

```python
from toolpath import WaitForJobReconnect

job = await wait_for_job(client, job_id, reconnect=WaitForJobReconnect(give_up_after=600))
```

`WaitForJobReconnect` takes four more options, all off by default:

- `jitter`, a fraction from 0 to 1, varies each wait by up to that much, so streams lost
  together do not reconnect together. A delay may shrink or grow by it; a `Retry-After` wait only
  grows, so it is spread too but never shorter than the server asked.
- `stable_after` starts the delays over only after a stream that stayed open that many seconds, rather
  than after any stream that sent the job, so a stream that opens and drops at once still backs off.
- `quiet_after` treats a stream that has sent nothing for that many seconds, keep-alives included, as
  lost, and opens another. It replaces the stream's 60-second read timeout, so it also bounds the
  wait for the response's headers: a timeout there is a stream that never opened, backed off with
  no `"lost"` and no look. (TypeScript's `quietMs` counts only from the response.) The server
  sends a keep-alive every 15 seconds; 45 is a sensible value.
- `look_on_loss` reads the job once (`GET /v1/jobs/{id}`) when a stream ends or is lost early. A
  final job settles the wait. A 401, 403, 404, 410 or any other 4xx but a 429 raises, while a 429,
  a 5xx or a failed connection goes on reconnecting, waiting the look's `Retry-After` where it is
  longer than the next delay.

A `jitter` outside 0 to 1, or not finite, raises `ValueError` when `WaitForJobReconnect` is made.

The first argument is an `AuthenticatedClient` or a `Client`, or a function, plain or async, that
returns one, called before each stream and each look, so a long wait can change its key. A refused
key (401, 403) still raises; whether to wait again with another key is the caller's choice. An
error the function raises ends the wait at once and is not retried. Return a client kept per key
rather than a new one each call: each holds an `httpx.AsyncClient` that stays open until closed.

`on_stream` is told `"open"` each time a stream's response arrives and, with `reconnect`,
`"lost"` when an open stream ends, drops or goes quiet before the job is final, before any look
and the wait to reconnect. Between the two no stream is listening. It is not called for a stream
that could not be opened, nor when the wait settles or is cancelled.

### A server that watches many jobs

A server that keeps a wait open for every job it is watching should use all four, so that streams
dropped together, by a deploy or a network blip, do not reconnect in step, a stream that flaps is
backed off, a connection that dies silently is noticed, and a job that finished meanwhile is
settled without another stream:

```python
# One client per key, made once and closed at shutdown: each holds an open httpx.AsyncClient.
clients: dict[str, AuthenticatedClient] = {}


def client_for_current_key() -> AuthenticatedClient:
    api_key = current_api_key()
    if api_key not in clients:
        clients[api_key] = AuthenticatedClient("https://api.toolpath.com", token=api_key)
    return clients[api_key]


job = await wait_for_job(
    client_for_current_key,
    job_id,
    reconnect=WaitForJobReconnect(jitter=0.2, stable_after=30, quiet_after=45, look_on_loss=True),
)
```

## Releases

The wheel carries `@toolpath/api`'s version. Versions are set in the private monorepo the
`packages/` directory here is mirrored from, and each release reaches this repository as a
`release-<name>` tag. After every release run, `scripts/check-python-sdk-release.mjs` looks for the
`python-sdk-v<version>` release. When it is missing, the `python-sdk-release` job in
`.github/workflows/release.yml` builds the wheel from the commit that run released, installs it in
a clean environment, and creates the release with the wheel attached. So a release ships both
SDKs, and re-running "Release public packages" for a release tag creates a Python release that is
missing. There is no setup and no token beyond the workflow's own.

If a release fails, re-run the failed `python-sdk-release` job. The job skips a release that
already exists. If the job stopped while uploading, a draft
release may be left behind; delete it (`gh release delete python-sdk-v<version> --yes`) before the
re-run. Do not replace the wheel on an existing release: anyone who installed that version expects
the same file.

## License

MIT
