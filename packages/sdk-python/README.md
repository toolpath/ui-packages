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

Create an API key in the [Toolpath portal](https://portal.toolpath.com/api-keys). See the
[Python example](../../examples/python) and [API documentation](https://developers.toolpath.com) for a
complete part-analysis flow.

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
after a stream that sent the job; `Reconnect(delays=..., give_up_after=...)` sets the waits, in
seconds, and gives up once reconnecting has failed for that long, after one last attempt. A quiet
job on an open stream does not count against it.

```python
from toolpath import Reconnect

job = await wait_for_job(client, job_id, reconnect=Reconnect(give_up_after=600))
```

## License

MIT
