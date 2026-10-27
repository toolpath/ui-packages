"""``wait_for_job`` against a mocked job event stream."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Callable, Sequence
from typing import Any

import httpx
import pytest

from toolpath import AuthenticatedClient, JobFailedError, WaitForJobReconnect, wait_for_job
from toolpath.generated.models import JobDetail, JobDetailStatus

JOB_ID = "0195f02d-6c1a-7b3e-9f00-000000000001"


def job(status: str, **extra: Any) -> str:
    # ``ensure_ascii=False`` writes the JSON the server's ``JSON.stringify`` does, which leaves
    # U+0085, U+2028 and U+2029 unescaped inside a string.
    return json.dumps(
        {
            "partUuid": None,
            "holderUuid": None,
            "jobUuid": JOB_ID,
            "productType": "analyze-part",
            "status": status,
            "progress": None,
            "error": None,
            "reportId": None,
            "importId": None,
            "createdAt": "2026-10-09T12:00:00.000Z",
            "updatedAt": "2026-10-09T12:00:00.000Z",
            "durationMs": 0,
            **extra,
        },
        ensure_ascii=False,
    )


def job_event(status: str, **extra: Any) -> str:
    return f"event: job\ndata: {job(status, **extra)}\n\n"


class EventStream(httpx.AsyncByteStream):
    """A response body that sends each chunk as it is given, then closes or raises ``error``."""

    def __init__(self, chunks: Sequence[str | bytes], error: Exception | None) -> None:
        self.chunks = chunks
        self.error = error

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self.chunks:
            yield chunk.encode() if isinstance(chunk, str) else chunk
        if self.error is not None:
            raise self.error


def client_with(handler: Callable[[httpx.Request], httpx.Response]) -> AuthenticatedClient:
    return AuthenticatedClient(
        "https://api.example.test",
        token="tp_test",
        httpx_args={"transport": httpx.MockTransport(handler)},
    )


def streaming(
    chunks: Sequence[str | bytes], *, error: Exception | None = None, requests: list[httpx.Request] | None = None
) -> AuthenticatedClient:
    def handler(request: httpx.Request) -> httpx.Response:
        if requests is not None:
            requests.append(request)
        return httpx.Response(200, headers={"Content-Type": "text/event-stream"}, stream=EventStream(chunks, error))

    return client_with(handler)


def wait(client: AuthenticatedClient, updates: list[JobDetail] | None = None) -> JobDetail:
    async def run() -> JobDetail:
        async with client:
            return await wait_for_job(client, JOB_ID, on_update=None if updates is None else updates.append)

    return asyncio.run(run())


def test_returns_the_job_once_it_succeeds() -> None:
    requests: list[httpx.Request] = []
    client = streaming(
        [
            job_event("queued"),
            ": keepalive\n\n",
            job_event("running", progress=40),
            job_event("succeeded", progress=100),
        ],
        requests=requests,
    )
    updates: list[JobDetail] = []

    finished = wait(client, updates)

    assert finished.status is JobDetailStatus.SUCCEEDED
    assert str(finished.job_uuid) == JOB_ID
    assert [(update.status, update.progress) for update in updates] == [
        (JobDetailStatus.QUEUED, None),
        (JobDetailStatus.RUNNING, 40),
        (JobDetailStatus.SUCCEEDED, 100),
    ]
    assert [str(request.url) for request in requests] == [f"https://api.example.test/v1/jobs/{JOB_ID}/events"]
    assert requests[0].headers["Accept"] == "text/event-stream"
    assert requests[0].headers["Authorization"] == "Bearer tp_test"


def test_raises_job_failed_error_with_the_failed_job() -> None:
    client = streaming([job_event("running"), job_event("failed", error="kernel_error: no solid body")])

    with pytest.raises(JobFailedError, match="^kernel_error: no solid body$") as failure:
        wait(client)

    assert failure.value.job.status is JobDetailStatus.FAILED
    assert failure.value.job.error == "kernel_error: no solid body"


def test_keeps_an_error_that_holds_unicode_line_separators_intact() -> None:
    error = "kernel_error: first\u2028second\u2029third\u0085fourth"
    client = streaming([job_event("failed", error=error)])

    with pytest.raises(JobFailedError) as failure:
        wait(client)

    assert failure.value.job.error == error


def test_raises_runtime_error_when_the_stream_ends_before_the_job_is_final() -> None:
    client = streaming([job_event("running", progress=10)])
    updates: list[JobDetail] = []

    with pytest.raises(
        RuntimeError, match=f"^The event stream for job {JOB_ID} ended before the job finished$"
    ) as lost:
        wait(client, updates)

    assert lost.value.__cause__ is None
    assert [update.progress for update in updates] == [10]


@pytest.mark.parametrize(
    "error",
    [
        httpx.RemoteProtocolError("peer closed connection without sending complete message body"),
        httpx.ReadError("[Errno 104] Connection reset by peer"),
        httpx.ReadTimeout("The read operation timed out"),
    ],
    ids=lambda error: type(error).__name__,
)
def test_raises_runtime_error_when_reading_the_stream_fails(error: httpx.TransportError) -> None:
    client = streaming([job_event("running")], error=error)
    updates: list[JobDetail] = []

    with pytest.raises(
        RuntimeError, match=f"^The event stream for job {JOB_ID} was lost before the job finished$"
    ) as lost:
        wait(client, updates)

    assert lost.value.__cause__ is error
    assert [update.status for update in updates] == [JobDetailStatus.RUNNING]


def test_raises_http_status_error_for_an_error_response() -> None:
    client = client_with(
        lambda _request: httpx.Response(
            404,
            headers={"Content-Type": "application/problem+json"},
            json={"code": "job_not_found", "status": 404},
        )
    )

    with pytest.raises(httpx.HTTPStatusError) as failure:
        wait(client)

    assert failure.value.response.status_code == 404


def test_raises_the_transport_error_when_the_stream_cannot_be_opened() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("[Errno 111] Connection refused", request=request)

    with pytest.raises(httpx.ConnectError):
        wait(client_with(refuse))


ONE_BYTE_EACH = [
    bytes([byte])
    for byte in (job_event("running", error="a\u2028b").replace("\n", "\r\n") + job_event("succeeded")).encode()
]


@pytest.mark.parametrize(
    "chunks",
    [
        pytest.param([(job_event("running") + job_event("succeeded")).replace("\n", "\r\n")], id="crlf"),
        pytest.param([(job_event("running") + job_event("succeeded")).replace("\n", "\r")], id="cr"),
        pytest.param(
            [
                "event: job\r",
                f"\ndata: {job('running')}\r",
                "\n\r",
                f"\nevent: job\r\ndata: {job('succeeded')}\r",
                "\n\r",
                "\n",
            ],
            id="crlf-split-across-chunks",
        ),
        pytest.param(
            ["event: job\r", f"\ndata: {job('running')}\r", "\n", "\n", job_event("succeeded")],
            id="crlf-split-across-chunks-then-lf",
        ),
        pytest.param(ONE_BYTE_EACH, id="one-byte-per-chunk"),
    ],
)
def test_ends_lines_at_crlf_lf_or_cr_however_the_chunks_split(chunks: list[str | bytes]) -> None:
    updates: list[JobDetail] = []

    wait(streaming(chunks), updates)

    assert [update.status for update in updates] == [JobDetailStatus.RUNNING, JobDetailStatus.SUCCEEDED]


def test_skips_comment_lines_and_other_events() -> None:
    client = streaming(
        [
            ": keepalive\n\n",
            ":\n",
            f": data: {job('failed')}\n\n",
            f"event: job\n: keepalive\ndata: {job('running')}\n\n",
            f"event: other\ndata: {job('failed')}\n\n",
            job_event("succeeded"),
        ]
    )
    updates: list[JobDetail] = []

    wait(client, updates)

    assert [update.status for update in updates] == [JobDetailStatus.RUNNING, JobDetailStatus.SUCCEEDED]


def test_joins_multi_line_data_and_strips_one_space_after_the_colon() -> None:
    running = job("running").replace(", ", ",\n").split("\n")
    # Without the space, ``data:`` and ``event:`` are read the same; with two, only one is removed,
    # so `` job`` is an event of another name.
    client = streaming(
        [
            "event: job\n" + "".join(f"data: {line}\n" for line in running) + "\n",
            f"event:  job\ndata: {job('failed')}\n\n",
            f"event:job\ndata:{job('succeeded')}\n\n",
        ]
    )
    updates: list[JobDetail] = []

    wait(client, updates)

    assert len(running) > 1
    assert [update.status for update in updates] == [JobDetailStatus.RUNNING, JobDetailStatus.SUCCEEDED]


def test_ignores_a_byte_order_mark_before_the_first_event() -> None:
    client = streaming(["﻿" + job_event("succeeded")])

    assert wait(client).status is JobDetailStatus.SUCCEEDED


def test_skips_a_job_in_a_status_this_sdk_does_not_know() -> None:
    updates: list[JobDetail] = []
    client = streaming([job_event("running"), job_event("paused"), job_event("succeeded")])

    wait(client, updates)

    assert [update.status for update in updates] == [JobDetailStatus.RUNNING, JobDetailStatus.SUCCEEDED]


def test_replaces_only_the_read_timeout_keeping_the_clients_others() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200, headers={"Content-Type": "text/event-stream"}, stream=EventStream([job_event("succeeded")], None)
        )

    client = AuthenticatedClient(
        "https://api.example.test",
        token="tp_test",
        timeout=httpx.Timeout(3.0, pool=7.0),
        httpx_args={"transport": httpx.MockTransport(handler)},
    )

    wait(client)

    assert requests[0].extensions["timeout"] == {"connect": 3.0, "read": 60.0, "write": 3.0, "pool": 7.0}


def answering(
    *results: str | int | httpx.Response | Exception, requests: list[httpx.Request] | None = None
) -> AuthenticatedClient:
    """A client whose server answers each request with the next result: a stream's text, a status, a
    response, or an exception raised as the transport's."""
    remaining = list(results)

    def handler(request: httpx.Request) -> httpx.Response:
        if requests is not None:
            requests.append(request)
        result = remaining.pop(0)
        if isinstance(result, Exception):
            raise result
        if isinstance(result, httpx.Response):
            return result
        if isinstance(result, int):
            headers = {"Retry-After": "2"} if result == 429 else {}
            return httpx.Response(result, headers=headers, json={"status": result})
        return httpx.Response(200, headers={"Content-Type": "text/event-stream"}, stream=EventStream([result], None))

    return client_with(handler)


class Clock:
    """``wait_for_job``'s clock: the seconds each reconnect waited, added to ``now`` instead of slept."""

    def __init__(self) -> None:
        self.now = 1_000.0
        self.waits: list[float] = []


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    timeline = Clock()

    async def sleep(seconds: float) -> None:
        timeline.waits.append(seconds)
        timeline.now += seconds

    monkeypatch.setattr("toolpath.jobs.sleep", sleep)
    monkeypatch.setattr("toolpath.jobs.monotonic", lambda: timeline.now)
    return timeline


@pytest.fixture
def waits(clock: Clock) -> list[float]:
    return clock.waits


def wait_reconnecting(
    client: AuthenticatedClient,
    reconnect: bool | WaitForJobReconnect,
    on_update: Callable[[JobDetail], None] | None = None,
) -> JobDetail:
    async def run() -> JobDetail:
        async with client:
            return await wait_for_job(client, JOB_ID, on_update=on_update, reconnect=reconnect)

    return asyncio.run(run())


def test_reconnect_opens_the_stream_again_when_it_ends_early(waits: list[float]) -> None:
    requests: list[httpx.Request] = []
    client = answering(
        job_event("running", progress=10),
        job_event("running", progress=60) + job_event("succeeded"),
        requests=requests,
    )
    updates: list[JobDetail] = []

    finished = wait_reconnecting(client, WaitForJobReconnect(delays=(0.5,)), updates.append)

    assert finished.status is JobDetailStatus.SUCCEEDED
    assert [update.progress for update in updates] == [10, 60, None]
    assert len(requests) == 2
    assert waits == [0.5]


def test_reconnect_opens_it_again_when_the_connection_fails_and_on_a_5xx(waits: list[float]) -> None:
    requests: list[httpx.Request] = []
    client = answering(httpx.ConnectError("refused"), 503, job_event("succeeded"), requests=requests)

    assert wait_reconnecting(client, True).status is JobDetailStatus.SUCCEEDED
    assert len(requests) == 3
    assert waits == [1.0, 2.0]


@pytest.mark.parametrize(
    "error",
    [
        httpx.ConnectTimeout("The connect operation timed out"),
        httpx.RemoteProtocolError("Server disconnected without sending a response."),
        httpx.ProxyError("503 Service Unavailable"),
    ],
    ids=lambda error: type(error).__name__,
)
def test_reconnect_opens_it_again_when_the_connection_times_out_closes_unanswered_or_the_proxy_cannot_connect(
    error: httpx.TransportError, waits: list[float]
) -> None:
    client = answering(error, job_event("succeeded"))

    assert wait_reconnecting(client, True).status is JobDetailStatus.SUCCEEDED
    assert waits == [1.0]


@pytest.mark.parametrize(
    "error",
    [
        httpx.UnsupportedProtocol("Request URL is missing an 'http://' or 'https://' protocol."),
        httpx.LocalProtocolError("Illegal header value"),
    ],
    ids=lambda error: type(error).__name__,
)
def test_reconnect_raises_a_set_up_mistake_at_once(error: httpx.TransportError, waits: list[float]) -> None:
    requests: list[httpx.Request] = []

    with pytest.raises(type(error)):
        wait_reconnecting(answering(error, requests=requests), True)

    assert len(requests) == 1
    assert waits == []


@pytest.mark.parametrize("status", [401, 403, 404, 410])
def test_reconnect_raises_at_once_for_a_refusal_asking_again_will_not_change(status: int, waits: list[float]) -> None:
    requests: list[httpx.Request] = []

    with pytest.raises(httpx.HTTPStatusError) as raised:
        wait_reconnecting(answering(status, requests=requests), True)

    assert raised.value.response.status_code == status
    assert len(requests) == 1
    assert waits == []


def test_reconnect_waits_for_a_429s_retry_after(waits: list[float]) -> None:
    client = answering(429, job_event("succeeded"))

    assert wait_reconnecting(client, WaitForJobReconnect(delays=(0.1,))).status is JobDetailStatus.SUCCEEDED
    assert waits == [2.0]


def test_reconnect_reads_a_retry_after_given_as_an_http_date(
    monkeypatch: pytest.MonkeyPatch, waits: list[float]
) -> None:
    # 2026-10-27T12:00:00Z, three seconds before the date the server names.
    monkeypatch.setattr("toolpath.jobs.time", lambda: 1_793_102_400.0)
    client = answering(
        httpx.Response(503, headers={"Retry-After": "Tue, 27 Oct 2026 12:00:03 GMT"}), job_event("succeeded")
    )

    assert wait_reconnecting(client, WaitForJobReconnect(delays=(0.1,))).status is JobDetailStatus.SUCCEEDED
    assert waits == [3.0]


@pytest.mark.parametrize("header", ["nan", "inf", "-inf", "not a delay"])
def test_reconnect_waits_its_own_delay_for_a_retry_after_that_is_no_delay(header: str, waits: list[float]) -> None:
    client = answering(httpx.Response(429, headers={"Retry-After": header}), job_event("succeeded"))

    assert wait_reconnecting(client, WaitForJobReconnect(delays=(0.1,))).status is JobDetailStatus.SUCCEEDED
    assert waits == [0.1]


def test_reconnect_starts_the_delays_over_after_a_stream_that_sent_the_job(waits: list[float]) -> None:
    client = answering("", job_event("running"), job_event("succeeded"))

    wait_reconnecting(client, WaitForJobReconnect(delays=(0.1, 1.0)))

    assert waits == [0.1, 0.1]


def test_reconnect_gives_up_at_once_for_a_retry_after_past_give_up_after(waits: list[float]) -> None:
    requests: list[httpx.Request] = []
    client = answering(httpx.Response(429, headers={"Retry-After": "120"}), requests=requests)

    with pytest.raises(httpx.HTTPStatusError) as raised:
        wait_reconnecting(client, WaitForJobReconnect(give_up_after=60))

    assert raised.value.response.status_code == 429
    assert len(requests) == 1
    assert waits == []


def test_reconnect_gives_up_once_give_up_after_would_pass_without_word_of_the_job(waits: list[float]) -> None:
    requests: list[httpx.Request] = []

    with pytest.raises(RuntimeError, match="ended before the job finished"):
        wait_reconnecting(answering("", requests=requests), WaitForJobReconnect(delays=(10.0,), give_up_after=0))

    assert len(requests) == 1
    assert waits == []


def test_reconnect_ends_the_wait_with_an_error_on_update_raises(waits: list[float]) -> None:
    requests: list[httpx.Request] = []
    mistake = ValueError("The caller could not handle the update")

    def fail(_: JobDetail) -> None:
        raise mistake

    with pytest.raises(ValueError) as raised:
        wait_reconnecting(answering(job_event("running"), requests=requests), WaitForJobReconnect(delays=(0.1,)), fail)

    assert raised.value is mistake
    assert len(requests) == 1


def test_reconnect_does_not_count_a_quiet_job_on_an_open_stream_against_give_up_after(clock: Clock) -> None:
    requests: list[httpx.Request] = []
    client = answering(job_event("queued"), job_event("succeeded"), requests=requests)

    def quiet(job: JobDetail) -> None:
        # Twenty quiet minutes on the first, healthy stream before it drops.
        if job.status is JobDetailStatus.QUEUED:
            clock.now += 20 * 60

    finished = wait_reconnecting(client, WaitForJobReconnect(delays=(1.0,), give_up_after=60), quiet)

    assert finished.status is JobDetailStatus.SUCCEEDED
    assert len(requests) == 2
    assert clock.waits == [1.0]


def test_reconnect_opens_one_last_stream_at_the_deadline_before_giving_up(clock: Clock) -> None:
    requests: list[httpx.Request] = []

    with pytest.raises(RuntimeError, match="ended before the job finished"):
        wait_reconnecting(
            answering("", "", "", "", "", requests=requests), WaitForJobReconnect(delays=(2.0,), give_up_after=5)
        )

    # At 0, 2 and 4 seconds, and the last at the deadline, 5.
    assert len(requests) == 4
    assert clock.waits == [2.0, 2.0, 1.0]
