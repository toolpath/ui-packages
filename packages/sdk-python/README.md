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
when it succeeds, raises `JobFailedError` carrying the job when it fails, and reopens the stream if
the server closes it first:

```python
from toolpath import AuthenticatedClient, wait_for_job

client = AuthenticatedClient("https://api.toolpath.com", token=api_key)
job = await wait_for_job(client, job_id, on_update=lambda job: print(job.status, job.progress))
```

## License

MIT
