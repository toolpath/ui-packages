# Toolpath Python SDK

`toolpath` provides generated Python bindings for the Toolpath Engine API, with helpers to upload a part
and to wait for a job.

Install it with your preferred Python package manager:

```bash
pip install toolpath
```

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

Every job reaches one of the two, so the one stream is enough. Losing the open stream first raises
`RuntimeError`: when the server closes it, and when reading it raises an `httpx.TransportError` — a
reset or dropped connection, or nothing received for 60 seconds — which becomes the `RuntimeError`'s
`__cause__`. Errors before the stream opens are httpx's own: `httpx.HTTPStatusError` for an error
response, and `httpx.TransportError` when no response arrives.

## License

MIT
