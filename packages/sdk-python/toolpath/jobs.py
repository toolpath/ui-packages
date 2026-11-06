"""Waiting for Engine API jobs on the job event stream."""

from __future__ import annotations

import json
import math
import re
from asyncio import sleep
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from contextlib import aclosing
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from inspect import isawaitable
from random import random
from time import monotonic, time
from typing import Literal, cast
from uuid import UUID

import httpx

from .generated.client import AuthenticatedClient, Client
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
    sent the job starts them over, or, with ``stable_after``, one that stayed open that long.
    ``give_up_after`` is how many seconds reconnecting may fail for, counted from when the last
    stream that sent the job ended, or from the start: one last stream is opened at that time, and
    the wait then raises the error that ended it. A quiet job on an open stream never counts against
    it. A 429 or 503 whose ``Retry-After`` falls past that time raises at once, without the last
    stream. ``None`` waits until the job is final.

    ``jitter``, a fraction from 0 to 1, varies each wait so that streams lost together — many waits
    on one server, say — do not all open again together. A delay is multiplied by a random factor
    from ``1 - jitter`` to ``1 + jitter``; a ``Retry-After`` wait by one from 1 to ``1 + jitter``, so
    it is spread too but never shorter than the server asked. 0, an exact wait, by default.

    ``stable_after`` is how many seconds a stream must stay open for its end to start the delays
    over. A stream that opens and drops at once then backs off all the same, even though it sent the
    job. ``None`` starts them over after any stream that sent the job. ``give_up_after`` still
    counts from the last stream that sent the job.

    ``quiet_after`` is how many seconds a stream may send nothing — no event and no keep-alive
    comment — before it is taken as lost and opened again. It replaces the 60 seconds the stream's
    read timeout is otherwise, so it also bounds the wait for the response's headers: a timeout
    there is a stream that never opened, backed off with no ``"lost"`` and no look. The Engine API
    sends a keep-alive every 15 seconds, so 45 seconds lets two go missing.

    ``look_on_loss`` reads the job once (``GET /v1/jobs/{id}``) when a stream ends or is lost
    before the job is final, before waiting to open the next. A final job settles the wait as if the
    stream had sent it, after ``on_update``; a job not yet final goes to ``on_update`` if it
    changed. An error response raises as it would on opening the stream — a refused key (401, 403),
    a job the key cannot reach (404, 410), or any other 4xx but a 429 — while a 429, a 5xx or a
    failed connection leaves the delays to go on. A 429's or 503's ``Retry-After`` longer than the
    next delay is waited instead, spread by ``jitter`` as any ``Retry-After`` is. Off by default.

    A ``jitter`` outside 0 to 1, or not finite, raises ``ValueError`` here.
    """

    delays: Sequence[float] = _RECONNECT_DELAYS
    give_up_after: float | None = None
    jitter: float = 0.0
    stable_after: float | None = None
    quiet_after: float | None = None
    look_on_loss: bool = False

    def __post_init__(self) -> None:
        if not (math.isfinite(self.jitter) and 0 <= self.jitter <= 1):
            raise ValueError(f"jitter must be from 0 to 1, not {self.jitter}")


# The client ``wait_for_job`` reads the job with, or a function that gives it one, plain or async.
WaitForJobClient = (
    AuthenticatedClient | Client | Callable[[], AuthenticatedClient | Client | Awaitable[AuthenticatedClient | Client]]
)


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


def _reconnect_delay(
    error: Exception,
    attempts: int,
    since_good: float,
    policy: WaitForJobReconnect,
    look_retry_after: float | None = None,
) -> float | None:
    """How many seconds to wait before opening the stream again after ``error``, or ``None`` to give
    up. ``attempts`` streams have failed since the last that sent the job, which ended
    ``since_good`` seconds ago. ``look_retry_after`` is the ``Retry-After`` a ``look_on_loss`` read
    was answered with, waited instead where it is the longer."""
    if not _reopens(error):
        return None
    retry_after = _retry_after(error)
    scheduled = retry_after
    if scheduled is None:
        scheduled = policy.delays[min(attempts, len(policy.delays) - 1)] if policy.delays else _RECONNECT_DELAYS[0]
    if look_retry_after is not None and look_retry_after > scheduled:
        retry_after = look_retry_after
    wait = scheduled if retry_after is None else retry_after
    if policy.jitter > 0:
        # A ``Retry-After`` is only ever lengthened: the server asked for at least that long.
        if retry_after is None:
            wait *= 1 - policy.jitter + 2 * policy.jitter * random()
        else:
            wait *= 1 + policy.jitter * random()
    if policy.give_up_after is None:
        return wait
    left = policy.give_up_after - since_good
    # A server's ``Retry-After`` past the deadline is respected by not asking again at all.
    if left <= 0 or (retry_after is not None and retry_after > left):
        return None
    return min(wait, left)


async def _client_now(client: WaitForJobClient) -> AuthenticatedClient | Client:
    """The client for the next request: ``client`` itself, as anything with an httpx client is, or
    what its function gives."""
    if hasattr(client, "get_async_httpx_client") or not callable(client):
        return cast("AuthenticatedClient | Client", client)
    current = client()
    return await current if isawaitable(current) else current


async def _look(client: AuthenticatedClient | Client, job_id: str | UUID) -> JobDetail | Exception | None:
    """The job as ``GET /v1/jobs/{id}`` reads it now; the error where the read failed in a way the
    next stream may not — a 429, a 5xx or a failed connection; or ``None`` where it found a status
    this SDK does not know. Any other error raises, as it would on opening the stream."""
    try:
        response = await client.get_async_httpx_client().get(f"/v1/jobs/{job_id}")
        response.raise_for_status()
    except Exception as error:
        if _reopens(error):
            return error
        raise
    fields = response.json()
    return JobDetail.from_dict(fields) if fields.get("status") in _KNOWN_STATUSES else None


async def wait_for_job(
    client: WaitForJobClient,
    job_id: str | UUID,
    *,
    on_update: Callable[[JobDetail], None] | None = None,
    on_stream: Callable[[Literal["open", "lost"]], None] | None = None,
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

    ``on_stream`` is called with ``"open"`` each time a stream's response arrives, and, with
    ``reconnect``, with ``"lost"`` when an open stream ends, drops or goes quiet before the job is
    final: before the ``look_on_loss`` read and before the wait to open the next. So between a
    ``"lost"`` and the next ``"open"`` no stream is listening. It is not called for a stream that
    could not be opened, nor when the wait settles or is cancelled; without ``reconnect`` a lost
    stream settles it. An error it raises ends the wait.

    ``client`` may be a function, plain or async, that gives the client for each request, so a long
    wait can change its key. A refused key (401, 403) still ends the wait rather than asking the
    function for another: the caller decides whether to wait again with a different key. An error
    the function raises ends the wait at once and is not retried.
    """
    if not reconnect:
        on_open = None if on_stream is None else lambda: on_stream("open")
        return await _stream_job(await _client_now(client), job_id, on_update, on_open=on_open)
    policy = WaitForJobReconnect() if reconnect is True else reconnect
    attempts = 0
    # When the connection was last known good: the start, or the end of a stream that sent the job.
    last_good_at = monotonic()
    # The job as ``on_update`` was last told it, so a look tells it only of a change.
    latest: JobDetail | None = None
    while True:
        sent = False
        opened_at: float | None = None
        caller_error: Exception | None = None

        def opened() -> None:
            nonlocal opened_at, caller_error
            opened_at = monotonic()
            if on_stream is not None:
                try:
                    on_stream("open")
                except Exception as error:
                    caller_error = error
                    raise

        def update(job: JobDetail) -> None:
            nonlocal sent, caller_error, latest
            sent = True
            latest = job
            if on_update is not None:
                try:
                    on_update(job)
                except Exception as error:
                    caller_error = error
                    raise

        current = await _client_now(client)
        try:
            return await _stream_job(current, job_id, update, policy.quiet_after, opened)
        except Exception as error:
            if error is caller_error:
                raise
            if sent:
                last_good_at = monotonic()
            if policy.stable_after is None:
                stable = sent
            else:
                stable = opened_at is not None and monotonic() - opened_at >= policy.stable_after
            if stable:
                attempts = 0
            lost = isinstance(error, _StreamEnded)
            if lost and on_stream is not None:
                on_stream("lost")
            look_error: Exception | None = None
            if policy.look_on_loss and lost:
                job = await _look(await _client_now(client), job_id)
                if isinstance(job, Exception):
                    look_error, job = job, None
                if job is not None and (latest is None or job.to_dict() != latest.to_dict()):
                    latest = job
                    if on_update is not None:
                        on_update(job)
                if job is not None and job.status is JobDetailStatus.SUCCEEDED:
                    return job
                if job is not None and job.status is JobDetailStatus.FAILED:
                    raise JobFailedError(job) from None
            look_retry_after = None if look_error is None else _retry_after(look_error)
            wait = _reconnect_delay(error, attempts, monotonic() - last_good_at, policy, look_retry_after)
            if wait is None:
                raise
            attempts += 1
            await sleep(wait)


async def _stream_job(
    client: AuthenticatedClient | Client,
    job_id: str | UUID,
    on_update: Callable[[JobDetail], None] | None,
    quiet_after: float | None = None,
    on_open: Callable[[], None] | None = None,
) -> JobDetail:
    """One stream of the job's events, read until the job is final or the stream ends. ``quiet_after``
    replaces its read timeout, and ``on_open`` is called once its response has arrived."""
    httpx_client = client.get_async_httpx_client()
    timeout = httpx_client.timeout
    async with httpx_client.stream(
        "GET",
        f"/v1/jobs/{job_id}/events",
        headers={"Accept": "text/event-stream"},
        timeout=httpx.Timeout(
            connect=timeout.connect,
            read=_STREAM_READ_TIMEOUT if quiet_after is None else quiet_after,
            write=timeout.write,
            pool=timeout.pool,
        ),
    ) as response:
        if response.is_error:
            await response.aread()
            response.raise_for_status()
        if on_open is not None:
            on_open()
        async with aclosing(_job_events(response, job_id)) as jobs:
            async for job in jobs:
                if on_update is not None:
                    on_update(job)
                if job.status is JobDetailStatus.SUCCEEDED:
                    return job
                if job.status is JobDetailStatus.FAILED:
                    raise JobFailedError(job)
    raise _StreamEnded(f"The event stream for job {job_id} ended before the job finished")
