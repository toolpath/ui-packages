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
when it succeeds, raises `JobFailedError` carrying the job when it fails, and reopens the stream if
the server closes it first:

```python
from toolpath import AuthenticatedClient, wait_for_job

client = AuthenticatedClient("https://api.toolpath.com", token=api_key)
job = await wait_for_job(client, job_id, on_update=lambda job: print(job.status, job.progress))
```

## License

MIT
