"""Waiting for Engine API jobs on the job event stream."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Callable
from contextlib import aclosing
from uuid import UUID

import httpx

from .generated.client import AuthenticatedClient
from .generated.models import JobDetail, JobDetailStatus

# The server sends a keep-alive comment every 15 seconds, so a read that waits four times as long
# means the connection is gone rather than quiet. It replaces any timeout set on the client, which
# a stream open for minutes could otherwise trip.
_STREAM_TIMEOUT = httpx.Timeout(30.0, read=60.0)


class JobFailedError(RuntimeError):
    """Raised by ``wait_for_job`` when the job fails. ``failed`` is final: the job will not run again."""

    def __init__(self, job: JobDetail) -> None:
        super().__init__(job.error or f"Job {job.job_uuid} failed")
        self.job = job


async def _job_events(response: httpx.Response) -> AsyncIterator[JobDetail]:
    """The ``job`` events of a server-sent event stream. Comments and other events are skipped."""
    event = ""
    data: list[str] = []
    async for raw_line in response.aiter_lines():
        line = raw_line.rstrip("\r\n")
        if line == "":
            if event == "job" and data:
                yield JobDetail.from_dict(json.loads("\n".join(data)))
            event = ""
            data = []
        elif not line.startswith(":"):
            field, _, value = line.partition(":")
            value = value.removeprefix(" ")
            if field == "event":
                event = value
            elif field == "data":
                data.append(value)


async def wait_for_job(
    client: AuthenticatedClient,
    job_id: str | UUID,
    *,
    on_update: Callable[[JobDetail], None] | None = None,
) -> JobDetail:
    """Wait for a job on the job event stream (``GET /v1/jobs/{id}/events``), not by polling.

    Returns the job once it succeeds and raises ``JobFailedError`` once it fails; both are final.
    ``on_update`` is called with the job each time the stream sends it. The server ends every stream
    after five minutes, so a stream that closes before the job is final is opened again, starting
    from the job as it is now. An error response — an unknown job, an expired one, a refused key —
    raises ``httpx.HTTPStatusError``.
    """
    while True:
        received = False
        async with client.get_async_httpx_client().stream(
            "GET",
            f"/v1/jobs/{job_id}/events",
            headers={"Accept": "text/event-stream"},
            timeout=_STREAM_TIMEOUT,
        ) as response:
            if response.is_error:
                await response.aread()
                response.raise_for_status()
            async with aclosing(_job_events(response)) as jobs:
                async for job in jobs:
                    received = True
                    if on_update is not None:
                        on_update(job)
                    if job.status is JobDetailStatus.SUCCEEDED:
                        return job
                    if job.status is JobDetailStatus.FAILED:
                        raise JobFailedError(job)
        # The server sends the job the moment a stream opens, so one that closed without it is not
        # the five-minute limit. Opening it again would only repeat whatever closed it.
        if not received:
            raise RuntimeError(f"The event stream for job {job_id} closed without sending the job")
