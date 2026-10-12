"""Waiting for Engine API jobs on the job event stream."""

from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator, Callable
from contextlib import aclosing
from uuid import UUID

import httpx

from .generated.client import AuthenticatedClient
from .generated.models import JobDetail, JobDetailStatus

# The server sends keep-alive comments on an idle stream, well inside the read timeout, so a read
# that waits this long means the connection is gone rather than quiet. It replaces any timeout set on
# the client, which a stream open for minutes could otherwise trip.
_STREAM_TIMEOUT = httpx.Timeout(30.0, read=60.0)

# A line ends at CRLF, LF, or CR, and nowhere else: ``str.splitlines`` and httpx's ``aiter_lines``
# also break at U+2028, U+0085 and the like, which JSON leaves unescaped inside a string.
_LINE_END = re.compile(r"\r\n|\n|\r")


class JobFailedError(RuntimeError):
    """Raised by ``wait_for_job`` when the job fails. ``failed`` is final: the job will not run again."""

    def __init__(self, job: JobDetail) -> None:
        super().__init__(job.error or f"Job {job.job_uuid} failed")
        self.job = job


async def _job_events(response: httpx.Response, job_id: str | UUID) -> AsyncIterator[JobDetail]:
    """The ``job`` events of a server-sent event stream, parsed as the text arrives.

    Comment lines — the server's keep-alives — and events of any other name are skipped. An
    ``httpx.TransportError`` while reading is raised as ``RuntimeError``, with it as the cause.
    """
    pending = ""
    after_cr = False
    event = ""
    data: list[str] = []
    try:
        async for chunk in response.aiter_text():
            if not chunk:
                continue
            # A CR that ended the last chunk ended its line there, so an LF that starts this one is
            # the rest of that CRLF rather than another, empty line.
            if after_cr and chunk.startswith("\n"):
                chunk = chunk[1:]
            after_cr = chunk.endswith("\r")
            *lines, pending = _LINE_END.split(pending + chunk)
            for line in lines:
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
    except httpx.TransportError as error:
        raise RuntimeError(f"The event stream for job {job_id} was lost before the job finished") from error


async def wait_for_job(
    client: AuthenticatedClient,
    job_id: str | UUID,
    *,
    on_update: Callable[[JobDetail], None] | None = None,
) -> JobDetail:
    """Wait for a job on the job event stream (``GET /v1/jobs/{id}/events``), not by polling.

    Returns the job once it succeeds and raises ``JobFailedError`` once it fails. Every job reaches
    one of the two — the Engine API fails a job whose worker stops — and the stream ends right after
    it, so the one stream is all there is to read. ``on_update`` is called with the job each time the
    stream sends it.

    Losing the open stream before either raises ``RuntimeError``: when the server closes it, and when
    reading it raises an ``httpx.TransportError`` — a reset or dropped connection, or nothing received
    for 60 seconds — which becomes the ``RuntimeError``'s ``__cause__``. Errors before the stream opens
    are httpx's own: ``httpx.HTTPStatusError`` for an error response — an unknown job, an expired one,
    a refused key — and ``httpx.TransportError`` when no response arrives.
    """
    async with client.get_async_httpx_client().stream(
        "GET",
        f"/v1/jobs/{job_id}/events",
        headers={"Accept": "text/event-stream"},
        timeout=_STREAM_TIMEOUT,
    ) as response:
        if response.is_error:
            await response.aread()
            response.raise_for_status()
        async with aclosing(_job_events(response, job_id)) as jobs:
            async for job in jobs:
                if on_update is not None:
                    on_update(job)
                if job.status is JobDetailStatus.SUCCEEDED:
                    return job
                if job.status is JobDetailStatus.FAILED:
                    raise JobFailedError(job)
    raise RuntimeError(f"The event stream for job {job_id} ended before the job finished")
