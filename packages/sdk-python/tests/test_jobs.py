"""``wait_for_job`` against a mocked job event stream."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Callable, Sequence
from typing import Any

import httpx
import pytest

from toolpath import AuthenticatedClient, JobFailedError, wait_for_job
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
