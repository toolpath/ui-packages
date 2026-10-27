"""Waiting for Engine API jobs on the job event stream."""

from __future__ import annotations

import json
import math
import re
from asyncio import sleep
from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import aclosing
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from time import monotonic, time
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

# The seconds ``wait_for_job`` waits before each new stream when ``reconnect`` names none.
_RECONNECT_DELAYS = (1.0, 2.0, 4.0, 8.0)


class JobFailedError(RuntimeError):
    """Raised by ``wait_for_job`` when the job fails. ``failed`` is final: the job will not run again."""

    def __init__(self, job: JobDetail) -> None:
        super().__init__(job.error or f"Job {job.job_uuid} failed")
        self.job = job


class _StreamEnded(RuntimeError):
    """The stream ended, or its connection was lost, before the job was final."""


@dataclass(frozen=True)
class WaitForJobReconnect:
    """How ``wait_for_job`` opens the job's stream again.

    ``delays`` are the seconds to wait before each new stream; the last repeats, and a stream that
    sent the job starts them over. ``give_up_after`` is how many seconds reconnecting may fail for,
    counted from when the last stream that sent the job ended, or from the start: one last stream is
    opened at that time, and the wait then raises the error that ended it. A quiet job on an open
    stream never counts against it. A 429 or 503 whose ``Retry-After`` falls past that time raises
    at once, without the last stream. ``None`` waits until the job is final.
    """

    delays: Sequence[float] = _RECONNECT_DELAYS
    give_up_after: float | None = None


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
        raise _StreamEnded(f"The event stream for job {job_id} was lost before the job finished") from error


def _reopens(error: Exception) -> bool:
    """Whether a stream that ended in ``error`` is worth opening again."""
    if isinstance(error, httpx.HTTPStatusError):
        return error.response.status_code == 429 or error.response.status_code >= 500
    # A stream that ended early, a connection that failed, timed out, or that the server closed before
    # it answered, or a proxy that could not reach the server: it answers a CONNECT with a 502 or 503
    # while the Engine API is down. httpx's other transport errors — a URL without ``http://`` or
    # ``https://``, a request it would not send — are the caller's set-up, and every try would raise
    # them again.
    return isinstance(
        error,
        (_StreamEnded, httpx.NetworkError, httpx.TimeoutException, httpx.RemoteProtocolError, httpx.ProxyError),
    )


def _retry_after(error: Exception) -> float | None:
    """A 429's or 503's ``Retry-After``, in seconds: delay-seconds or an HTTP date."""
    header = error.response.headers.get("Retry-After") if isinstance(error, httpx.HTTPStatusError) else None
    if not header:
        return None
    try:
        seconds = float(header)
    except ValueError:
        pass
    else:
        # ``float`` also reads ``nan`` and ``inf``, which are no delay.
        if math.isfinite(seconds):
            return max(0.0, seconds)
    try:
        at = parsedate_to_datetime(header)
    except (TypeError, ValueError):
        return None
    return max(0.0, at.timestamp() - time())


def _reconnect_delay(error: Exception, attempts: int, since_good: float, policy: WaitForJobReconnect) -> float | None:
    """How many seconds to wait before opening the stream again after ``error``, or ``None`` to give
    up. ``attempts`` streams have failed since the last that sent the job, which ended
    ``since_good`` seconds ago."""
    if not _reopens(error):
        return None
    retry_after = _retry_after(error)
    wait = retry_after
    if wait is None:
        wait = policy.delays[min(attempts, len(policy.delays) - 1)] if policy.delays else _RECONNECT_DELAYS[0]
    if policy.give_up_after is None:
        return wait
    left = policy.give_up_after - since_good
    # A server's ``Retry-After`` past the deadline is respected by not asking again at all.
    if left <= 0 or (retry_after is not None and retry_after > left):
        return None
    return min(wait, left)


async def wait_for_job(
    client: AuthenticatedClient,
    job_id: str | UUID,
    *,
    on_update: Callable[[JobDetail], None] | None = None,
    reconnect: bool | WaitForJobReconnect = False,
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

    With ``reconnect`` it opens the stream again itself instead: when it ends before the job is
    final, when the connection fails, and on a 429 — after its ``Retry-After`` — or a 5xx response.
    Every other error response raises as without it: a refused key (401, 403) or a job the key
    cannot reach (404, 410) will not change by asking again, and a job the server can no longer find
    answers the new stream with one of those. So does a mistake in the set-up: a URL without
    ``http://`` or ``https://``, or a request httpx would not send. ``True`` uses
    ``WaitForJobReconnect()``'s delays. An error ``on_update`` raises ends the wait.
    """
    if not reconnect:
        return await _stream_job(client, job_id, on_update)
    policy = WaitForJobReconnect() if reconnect is True else reconnect
    attempts = 0
    # When the connection was last known good: the start, or the end of a stream that sent the job.
    last_good_at = monotonic()
    while True:
        sent = False
        caller_error: Exception | None = None

        def update(job: JobDetail) -> None:
            nonlocal sent, caller_error
            sent = True
            if on_update is not None:
                try:
                    on_update(job)
                except Exception as error:
                    caller_error = error
                    raise

        try:
            return await _stream_job(client, job_id, update)
        except Exception as error:
            if error is caller_error:
                raise
            if sent:
                attempts = 0
                last_good_at = monotonic()
            wait = _reconnect_delay(error, attempts, monotonic() - last_good_at, policy)
            if wait is None:
                raise
            attempts += 1
            await sleep(wait)


async def _stream_job(
    client: AuthenticatedClient,
    job_id: str | UUID,
    on_update: Callable[[JobDetail], None] | None,
) -> JobDetail:
    """One stream of the job's events, read until the job is final or the stream ends."""
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
    raise _StreamEnded(f"The event stream for job {job_id} ended before the job finished")
