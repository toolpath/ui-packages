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

# The server sends keep-alive comments on an idle stream, well inside this, so a read that waits
# this long means the connection is gone rather than quiet. It replaces only the client's read
# timeout, which a stream open for minutes could otherwise trip; connect, write and pool stay the
# client's own.
_STREAM_READ_TIMEOUT = 60.0

# The job statuses this SDK's ``JobDetail`` can hold. An event naming any other — one a later API
# release adds — is skipped rather than failing the wait, since only the final two end it.
_KNOWN_STATUSES = frozenset(status.value for status in JobDetailStatus)

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

    Comment lines — the server's keep-alives — events of any other name, and jobs in a status this
    SDK does not know are skipped. An ``httpx.TransportError`` while reading is raised as
    ``RuntimeError``, with it as the cause.
    """
    pending = ""
    first = True
    after_cr = False
    event = ""
    data: list[str] = []
    try:
        async for chunk in response.aiter_text():
            if first:
                # A stream may open with a byte order mark, which is not part of its first line.
                chunk = chunk.removeprefix("\ufeff")
                first = False
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
                        fields = json.loads("\n".join(data))
                        if fields.get("status") in _KNOWN_STATUSES:
                            yield JobDetail.from_dict(fields)
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

    The stream ending before either raises ``RuntimeError``. The server closes it early when the job
    expired or was deleted while it waited, or when it could not read the job, and reading it can
    raise an ``httpx.TransportError`` — a reset or dropped connection, or nothing received for 60
    seconds — which becomes the ``RuntimeError``'s ``__cause__``. Calling ``wait_for_job`` once more
    is safe, since a new stream starts with the job as it is now, and ``get_job`` says which it was. Errors before the stream opens
    are httpx's own: ``httpx.HTTPStatusError`` for an error response — an unknown job, an expired one,
    a refused key — and ``httpx.TransportError`` when no response arrives.
    """
    httpx_client = client.get_async_httpx_client()
    timeout = httpx_client.timeout
    async with httpx_client.stream(
        "GET",
        f"/v1/jobs/{job_id}/events",
        headers={"Accept": "text/event-stream"},
        timeout=httpx.Timeout(
            connect=timeout.connect, read=_STREAM_READ_TIMEOUT, write=timeout.write, pool=timeout.pool
        ),
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
