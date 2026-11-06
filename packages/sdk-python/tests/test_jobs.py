"""``wait_for_job`` against a mocked job event stream."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Callable, Sequence
from typing import Any

import httpx
import pytest

from toolpath import AuthenticatedClient, Client, JobFailedError, WaitForJobReconnect, wait_for_job
from toolpath.generated.models import JobDetail, JobDetailStatus

JOB_ID = "0195f02d-6c1a-7b3e-9f00-000000000001"


def job(status: str, **extra: Any) -> str:
    # ``ensure_ascii=False`` writes the JSON the server's ``JSON.stringify`` does, which leaves
    # U+0085, U+2028 and U+2029 unescaped inside a string.
    return json.dumps(
        {
            "partUuid": None,
            "holderUuid": None,
            "fileUuid": None,
            "jobUuid": JOB_ID,
            "productType": "analyze-part",
            "status": status,
            "progress": None,
            "retriesRemaining": None,
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


def look(status: str, **extra: Any) -> httpx.Response:
    """A ``GET /v1/jobs/{id}`` answer."""
    return httpx.Response(200, headers={"Content-Type": "application/json"}, content=job(status, **extra))


def lost(error: httpx.TransportError, *chunks: str) -> httpx.Response:
    """A stream that sends ``chunks`` and then loses its connection with ``error``."""
    return httpx.Response(200, headers={"Content-Type": "text/event-stream"}, stream=EventStream(chunks, error))


def test_jitter_unset_waits_exactly_the_delay_without_drawing_a_random_number(
    monkeypatch: pytest.MonkeyPatch, waits: list[float]
) -> None:
    def draw() -> float:
        raise AssertionError("no random number should be drawn")

    monkeypatch.setattr("toolpath.jobs.random", draw)

    wait_reconnecting(answering("", job_event("succeeded")), WaitForJobReconnect(delays=(1.0,)))

    assert waits == [1.0]


@pytest.mark.parametrize(("draw", "seconds"), [(0.0, 0.8), (0.5, 1.0), (0.75, 1.1)])
def test_jitter_varies_each_wait_either_way(
    draw: float, seconds: float, monkeypatch: pytest.MonkeyPatch, waits: list[float]
) -> None:
    monkeypatch.setattr("toolpath.jobs.random", lambda: draw)

    wait_reconnecting(answering("", job_event("succeeded")), WaitForJobReconnect(delays=(1.0,), jitter=0.2))

    assert waits == [pytest.approx(seconds)]


@pytest.mark.parametrize(("draw", "seconds"), [(0.0, 2.0), (0.5, 2.5), (1.0, 3.0)])
def test_jitter_only_lengthens_a_retry_after(
    draw: float, seconds: float, monkeypatch: pytest.MonkeyPatch, waits: list[float]
) -> None:
    monkeypatch.setattr("toolpath.jobs.random", lambda: draw)

    wait_reconnecting(answering(429, job_event("succeeded")), WaitForJobReconnect(delays=(0.1,), jitter=0.5))

    assert waits == [pytest.approx(seconds)]


def test_stable_after_goes_on_to_the_next_delay_after_a_stream_that_sent_the_job_but_dropped_at_once(
    waits: list[float],
) -> None:
    client = answering("", job_event("running"), job_event("succeeded"))

    wait_reconnecting(client, WaitForJobReconnect(delays=(0.1, 1.0), stable_after=30))

    assert waits == [0.1, 1.0]


def test_stable_after_starts_the_delays_over_after_a_stream_that_stayed_open_that_long(clock: Clock) -> None:
    client = answering("", job_event("running"), job_event("succeeded"))

    def stay_open(job: JobDetail) -> None:
        # The second stream stays open forty seconds before it ends.
        if job.status is JobDetailStatus.RUNNING:
            clock.now += 40

    wait_reconnecting(client, WaitForJobReconnect(delays=(0.1, 1.0), stable_after=30), stay_open)

    assert clock.waits == [0.1, 0.1]


def test_quiet_after_replaces_only_the_read_timeout() -> None:
    requests: list[httpx.Request] = []
    client = answering(job_event("succeeded"), requests=requests)

    wait_reconnecting(client, WaitForJobReconnect(quiet_after=45))

    assert requests[0].extensions["timeout"]["read"] == 45


def test_quiet_after_opens_the_stream_again_once_a_read_times_out(waits: list[float]) -> None:
    requests: list[httpx.Request] = []
    client = answering(
        lost(httpx.ReadTimeout("The read operation timed out"), job_event("running")),
        job_event("succeeded"),
        requests=requests,
    )

    finished = wait_reconnecting(client, WaitForJobReconnect(delays=(1.0,), quiet_after=45))

    assert finished.status is JobDetailStatus.SUCCEEDED
    assert len(requests) == 2


def test_look_on_loss_returns_a_succeeded_job_after_on_update_without_another_stream(waits: list[float]) -> None:
    requests: list[httpx.Request] = []
    client = answering(job_event("running"), look("succeeded", reportId="report-1"), requests=requests)
    updates: list[JobDetail] = []

    finished = wait_reconnecting(client, WaitForJobReconnect(look_on_loss=True), updates.append)

    assert finished.status is JobDetailStatus.SUCCEEDED
    assert finished.report_id == "report-1"
    assert [update.status for update in updates] == [JobDetailStatus.RUNNING, JobDetailStatus.SUCCEEDED]
    assert [str(request.url) for request in requests] == [
        f"https://api.example.test/v1/jobs/{JOB_ID}/events",
        f"https://api.example.test/v1/jobs/{JOB_ID}",
    ]
    assert waits == []


def test_look_on_loss_raises_job_failed_error_for_a_failed_job_after_on_update(waits: list[float]) -> None:
    client = answering(job_event("running"), look("failed", error="kernel_error: no body"))
    updates: list[JobDetail] = []

    with pytest.raises(JobFailedError, match="^kernel_error: no body$"):
        wait_reconnecting(client, WaitForJobReconnect(look_on_loss=True), updates.append)

    assert [update.status for update in updates] == [JobDetailStatus.RUNNING, JobDetailStatus.FAILED]
    assert waits == []


@pytest.mark.parametrize("status", [404, 410, 401])
def test_look_on_loss_raises_an_error_response_as_opening_the_stream_would(status: int, waits: list[float]) -> None:
    requests: list[httpx.Request] = []

    with pytest.raises(httpx.HTTPStatusError) as raised:
        wait_reconnecting(
            answering(job_event("running"), status, requests=requests), WaitForJobReconnect(look_on_loss=True)
        )

    assert raised.value.response.status_code == status
    assert len(requests) == 2
    assert waits == []


@pytest.mark.parametrize(
    "answer", [503, httpx.ConnectError("[Errno 111] Connection refused")], ids=["503", "ConnectError"]
)
def test_look_on_loss_goes_on_to_the_next_stream_when_the_look_fails(
    answer: int | Exception, waits: list[float]
) -> None:
    requests: list[httpx.Request] = []
    client = answering(job_event("running"), answer, job_event("succeeded"), requests=requests)

    assert wait_reconnecting(client, WaitForJobReconnect(look_on_loss=True)).status is JobDetailStatus.SUCCEEDED
    assert len(requests) == 3
    assert waits == [1.0]


def test_look_on_loss_tells_on_update_of_a_job_not_yet_final_only_when_it_changed(waits: list[float]) -> None:
    client = answering(
        job_event("running", progress=10),
        look("running", progress=10),
        "",
        look("running", progress=50),
        job_event("succeeded"),
    )
    updates: list[JobDetail] = []

    wait_reconnecting(client, WaitForJobReconnect(delays=(0.1,), look_on_loss=True), updates.append)

    assert [update.progress for update in updates] == [10, 50, None]
    assert waits == [0.1, 0.1]


def test_look_on_loss_does_not_look_after_a_stream_that_could_not_be_opened(waits: list[float]) -> None:
    requests: list[httpx.Request] = []
    client = answering(503, job_event("succeeded"), requests=requests)

    wait_reconnecting(client, WaitForJobReconnect(look_on_loss=True))

    assert [request.url.path for request in requests] == [f"/v1/jobs/{JOB_ID}/events"] * 2


def test_a_client_function_is_asked_before_every_stream_and_every_look(waits: list[float]) -> None:
    first_requests: list[httpx.Request] = []
    second_requests: list[httpx.Request] = []
    first = answering(job_event("running"), requests=first_requests)
    second = answering(look("running"), job_event("succeeded"), requests=second_requests)
    given = [first, second, second]
    asked: list[AuthenticatedClient] = []

    async def choose() -> AuthenticatedClient:
        asked.append(given.pop(0))
        return asked[-1]

    async def run() -> JobDetail:
        async with first, second:
            return await wait_for_job(choose, JOB_ID, reconnect=WaitForJobReconnect(look_on_loss=True))

    assert asyncio.run(run()).status is JobDetailStatus.SUCCEEDED
    assert asked == [first, second, second]
    assert len(first_requests) == 1
    assert len(second_requests) == 2


def test_a_plain_client_function_is_asked_once_without_reconnect() -> None:
    client = streaming([job_event("succeeded")])
    asked: list[AuthenticatedClient] = []

    def choose() -> AuthenticatedClient:
        asked.append(client)
        return client

    async def run() -> JobDetail:
        async with client:
            return await wait_for_job(choose, JOB_ID)

    assert asyncio.run(run()).status is JobDetailStatus.SUCCEEDED
    assert len(asked) == 1


def test_a_client_function_does_not_turn_a_refused_key_into_another_try(waits: list[float]) -> None:
    client = answering(401)
    asked: list[AuthenticatedClient] = []

    def choose() -> AuthenticatedClient:
        asked.append(client)
        return client

    async def run() -> JobDetail:
        async with client:
            return await wait_for_job(choose, JOB_ID, reconnect=True)

    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(run())

    assert len(asked) == 1
    assert waits == []


def test_watching_from_a_server_combines_every_option(monkeypatch: pytest.MonkeyPatch, clock: Clock) -> None:
    monkeypatch.setattr("toolpath.jobs.random", lambda: 0.0)
    requests: list[httpx.Request] = []
    client = answering(
        lost(httpx.ReadTimeout("The read operation timed out"), job_event("running", progress=10)),
        look("running", progress=20),
        job_event("running", progress=30),
        503,
        503,
        job_event("succeeded"),
        requests=requests,
    )
    asked: list[AuthenticatedClient] = []

    def choose() -> AuthenticatedClient:
        asked.append(client)
        return client

    progress: list[int | None] = []

    def update(job: JobDetail) -> None:
        progress.append(job.progress)
        # The first stream stays open past stable_after before it goes quiet.
        if job.progress == 10:
            clock.now += 45

    async def run() -> JobDetail:
        async with client:
            return await wait_for_job(
                choose,
                JOB_ID,
                on_update=update,
                reconnect=WaitForJobReconnect(
                    delays=(1.0, 5.0), jitter=0.2, stable_after=30, quiet_after=45, look_on_loss=True
                ),
            )

    assert asyncio.run(run()).status is JobDetailStatus.SUCCEEDED
    assert progress == [10, 20, 30, None]
    # Stable, so the first delay; then a stream that dropped at once, looked at with a 503, and a
    # 503 opening the next: the second delay twice, each less a fifth.
    assert clock.waits == [pytest.approx(0.8), pytest.approx(4.0), pytest.approx(4.0)]
    assert [request.url.path for request in requests] == [
        f"/v1/jobs/{JOB_ID}/events",
        f"/v1/jobs/{JOB_ID}",
        f"/v1/jobs/{JOB_ID}/events",
        f"/v1/jobs/{JOB_ID}",
        f"/v1/jobs/{JOB_ID}/events",
        f"/v1/jobs/{JOB_ID}/events",
    ]
    assert requests[0].extensions["timeout"]["read"] == 45
    assert len(asked) == 6


def watch_streams(
    client: AuthenticatedClient,
    reconnect: bool | WaitForJobReconnect,
    events: list[str],
) -> JobDetail:
    """Wait, recording each ``on_stream`` state and each update's status and progress in ``events``."""

    async def run() -> JobDetail:
        async with client:
            return await wait_for_job(
                client,
                JOB_ID,
                on_update=lambda job: events.append(f"{job.status.value} {job.progress}"),
                on_stream=events.append,
                reconnect=reconnect,
            )

    return asyncio.run(run())


def test_on_stream_reports_a_lost_stream_before_the_look_and_the_look_before_the_next_stream(
    waits: list[float],
) -> None:
    events: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        events.append(f"request {request.url.path.removeprefix(f'/v1/jobs/{JOB_ID}') or '/'}")
        return answers.pop(0)

    answers = [
        lost(httpx.ReadError("[Errno 104] Connection reset by peer"), job_event("running")),
        look("running", progress=50),
        httpx.Response(
            200, headers={"Content-Type": "text/event-stream"}, stream=EventStream([job_event("succeeded")], None)
        ),
    ]

    watch_streams(client_with(handler), WaitForJobReconnect(look_on_loss=True), events)

    assert events == [
        "request /events",
        "open",
        "running None",
        "lost",
        "request /",
        "running 50",
        "request /events",
        "open",
        "succeeded None",
    ]
    assert waits == [1.0]


def test_on_stream_reports_a_stream_that_went_quiet_as_lost_before_the_wait(clock: Clock) -> None:
    events: list[str] = []
    client = answering(
        lost(httpx.ReadTimeout("The read operation timed out"), job_event("running")), job_event("succeeded")
    )

    async def sleep(seconds: float) -> None:
        events.append(f"wait {seconds}")

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr("toolpath.jobs.sleep", sleep)
        watch_streams(client, WaitForJobReconnect(delays=(1.0,), quiet_after=45), events)

    assert events == ["open", "running None", "lost", "wait 1.0", "open", "succeeded None"]


def test_on_stream_is_not_called_for_a_stream_that_could_not_be_opened_nor_when_the_wait_settles(
    waits: list[float],
) -> None:
    events: list[str] = []

    with pytest.raises(JobFailedError):
        watch_streams(answering(httpx.ConnectError("refused"), 503, job_event("failed")), True, events)

    assert events == ["open", "failed None"]


def test_on_stream_reports_only_open_without_reconnect() -> None:
    events: list[str] = []

    with pytest.raises(RuntimeError, match="ended before the job finished"):
        watch_streams(streaming([job_event("running")]), False, events)

    assert events == ["open", "running None"]


def test_on_stream_ends_the_wait_with_an_error_it_raises(waits: list[float]) -> None:
    requests: list[httpx.Request] = []
    mistake = ValueError("The caller could not handle the stream")

    def fail(_: str) -> None:
        raise mistake

    async def run() -> JobDetail:
        client = answering(job_event("running"), requests=requests)
        async with client:
            return await wait_for_job(client, JOB_ID, on_stream=fail, reconnect=True)

    with pytest.raises(ValueError) as raised:
        asyncio.run(run())

    assert raised.value is mistake
    assert len(requests) == 1
    assert waits == []


def test_a_plain_client_is_used_as_it_is_rather_than_called() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200, headers={"Content-Type": "text/event-stream"}, stream=EventStream([job_event("succeeded")], None)
        )

    client = Client("https://api.example.test", httpx_args={"transport": httpx.MockTransport(handler)})

    async def run() -> JobDetail:
        async with client:
            return await wait_for_job(client, JOB_ID, reconnect=True)

    assert asyncio.run(run()).status is JobDetailStatus.SUCCEEDED
    assert len(requests) == 1


def test_anything_with_an_httpx_client_is_used_as_it_is() -> None:
    inner = streaming([job_event("succeeded")])

    class Wrapped:
        def get_async_httpx_client(self) -> httpx.AsyncClient:
            return inner.get_async_httpx_client()

        def __call__(self) -> AuthenticatedClient:
            raise AssertionError("a client is not called")

    async def run() -> JobDetail:
        async with inner:
            return await wait_for_job(Wrapped(), JOB_ID)  # type: ignore[arg-type]

    assert asyncio.run(run()).status is JobDetailStatus.SUCCEEDED


@pytest.mark.parametrize(("retry_after", "seconds"), [("5", 5.0), ("1", 2.0)])
def test_look_on_loss_waits_the_looks_retry_after_where_it_is_longer_than_the_delay(
    retry_after: str, seconds: float, waits: list[float]
) -> None:
    client = answering(
        job_event("running"), httpx.Response(503, headers={"Retry-After": retry_after}), job_event("succeeded")
    )

    wait_reconnecting(client, WaitForJobReconnect(delays=(2.0,), look_on_loss=True))

    assert waits == [seconds]


def test_look_on_loss_only_lengthens_the_looks_retry_after_with_jitter(
    monkeypatch: pytest.MonkeyPatch, waits: list[float]
) -> None:
    monkeypatch.setattr("toolpath.jobs.random", lambda: 0.5)
    client = answering(job_event("running"), httpx.Response(429, headers={"Retry-After": "5"}), job_event("succeeded"))

    wait_reconnecting(client, WaitForJobReconnect(delays=(1.0,), jitter=0.2, look_on_loss=True))

    assert waits == [pytest.approx(5.5)]


@pytest.mark.parametrize("jitter", [-0.1, 1.5, float("nan"), float("inf")])
def test_jitter_outside_zero_to_one_raises_value_error(jitter: float) -> None:
    with pytest.raises(ValueError, match="jitter must be from 0 to 1"):
        WaitForJobReconnect(jitter=jitter)


@pytest.mark.parametrize("jitter", [0.0, 1.0])
def test_jitter_of_zero_or_one_is_accepted(jitter: float) -> None:
    assert WaitForJobReconnect(jitter=jitter).jitter == jitter


def test_quiet_after_drops_a_stream_that_goes_silent_on_a_real_connection() -> None:
    """A local server: the first stream sends one event and then nothing, the second the final job."""
    events: list[str] = []
    connections = 0

    async def serve(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        nonlocal connections
        connections += 1
        await reader.readuntil(b"\r\n\r\n")
        if connections == 1:
            body = job_event("running").encode()
            writer.write(
                b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n"
                + f"{len(body):x}\r\n".encode()
                + body
                + b"\r\n"
            )
            await writer.drain()
            # Silent, as a connection that died without closing: no keep-alive, no end.
            await asyncio.sleep(30)
        else:
            body = job_event("succeeded").encode()
            writer.write(
                b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n"
                + f"Content-Length: {len(body)}\r\n\r\n".encode()
                + body
            )
            await writer.drain()
        writer.close()

    async def run() -> JobDetail:
        server = await asyncio.start_server(serve, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]
        try:
            async with AuthenticatedClient(f"http://127.0.0.1:{port}", token="tp_test") as client:
                return await asyncio.wait_for(
                    wait_for_job(
                        client,
                        JOB_ID,
                        on_update=lambda job: events.append(job.status.value),
                        on_stream=events.append,
                        reconnect=WaitForJobReconnect(delays=(0.0,), quiet_after=0.2),
                    ),
                    timeout=5,
                )
        finally:
            server.close()

    assert asyncio.run(run()).status is JobDetailStatus.SUCCEEDED
    assert events == ["open", "running", "lost", "open", "succeeded"]
    assert connections == 2
