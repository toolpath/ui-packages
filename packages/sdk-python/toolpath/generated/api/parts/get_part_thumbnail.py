from http import HTTPStatus
from io import BytesIO
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem_details import ProblemDetails
from ...types import UNSET, File, Response, Unset


def _get_kwargs(
    id: str,
    *,
    job_id: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["jobId"] = job_id

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/parts/{id}/thumbnail".format(
            id=quote(str(id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> File | ProblemDetails | None:
    if response.status_code == 200:
        response_200 = File(payload=BytesIO(response.content))

        return response_200

    if response.status_code == 400:
        response_400 = ProblemDetails.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = ProblemDetails.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = ProblemDetails.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = ProblemDetails.from_dict(response.json())

        return response_404

    if response.status_code == 410:
        response_410 = ProblemDetails.from_dict(response.json())

        return response_410

    if response.status_code == 500:
        response_500 = ProblemDetails.from_dict(response.json())

        return response_500

    if response.status_code == 503:
        response_503 = ProblemDetails.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[File | ProblemDetails]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    job_id: str | Unset = UNSET,
) -> Response[File | ProblemDetails]:
    """Get part thumbnail

     Requires **Analyze a part** (`PATCH /parts/{id}`) to have run and its job to have succeeded.

    Serves the rendered PNG thumbnail for a part as image bytes, so a client can fetch it with the
    API key it already holds rather than reading `thumbnailUrl` off `GET /v1/parts/{id}` first.
    The thumbnail is the kernel’s three-quarter view of the analyzed part.

    The bytes are served through this request rather than as a redirect to a presigned URL: a
    thumbnail is a few kB, and streaming it keeps the disclosure on this request’s access audit
    instead of handing out a bearer grant that outlives it. `thumbnailUrl` on the part response is
    still the right choice for an `<img src>`, which cannot carry an Authorization header.

    Resolves the same artifact `GET /v1/parts/{id}` reports — the latest analysis run by default,
    or the run named by `?jobId=`. A part whose analysis produced no thumbnail answers 404.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (str | Unset): Serve the thumbnail from this specific processing run instead of the
            latest result. Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
        job_id=job_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    job_id: str | Unset = UNSET,
) -> File | ProblemDetails | None:
    """Get part thumbnail

     Requires **Analyze a part** (`PATCH /parts/{id}`) to have run and its job to have succeeded.

    Serves the rendered PNG thumbnail for a part as image bytes, so a client can fetch it with the
    API key it already holds rather than reading `thumbnailUrl` off `GET /v1/parts/{id}` first.
    The thumbnail is the kernel’s three-quarter view of the analyzed part.

    The bytes are served through this request rather than as a redirect to a presigned URL: a
    thumbnail is a few kB, and streaming it keeps the disclosure on this request’s access audit
    instead of handing out a bearer grant that outlives it. `thumbnailUrl` on the part response is
    still the right choice for an `<img src>`, which cannot carry an Authorization header.

    Resolves the same artifact `GET /v1/parts/{id}` reports — the latest analysis run by default,
    or the run named by `?jobId=`. A part whose analysis produced no thumbnail answers 404.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (str | Unset): Serve the thumbnail from this specific processing run instead of the
            latest result. Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | ProblemDetails
    """

    return sync_detailed(
        id=id,
        client=client,
        job_id=job_id,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    job_id: str | Unset = UNSET,
) -> Response[File | ProblemDetails]:
    """Get part thumbnail

     Requires **Analyze a part** (`PATCH /parts/{id}`) to have run and its job to have succeeded.

    Serves the rendered PNG thumbnail for a part as image bytes, so a client can fetch it with the
    API key it already holds rather than reading `thumbnailUrl` off `GET /v1/parts/{id}` first.
    The thumbnail is the kernel’s three-quarter view of the analyzed part.

    The bytes are served through this request rather than as a redirect to a presigned URL: a
    thumbnail is a few kB, and streaming it keeps the disclosure on this request’s access audit
    instead of handing out a bearer grant that outlives it. `thumbnailUrl` on the part response is
    still the right choice for an `<img src>`, which cannot carry an Authorization header.

    Resolves the same artifact `GET /v1/parts/{id}` reports — the latest analysis run by default,
    or the run named by `?jobId=`. A part whose analysis produced no thumbnail answers 404.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (str | Unset): Serve the thumbnail from this specific processing run instead of the
            latest result. Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
        job_id=job_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    job_id: str | Unset = UNSET,
) -> File | ProblemDetails | None:
    """Get part thumbnail

     Requires **Analyze a part** (`PATCH /parts/{id}`) to have run and its job to have succeeded.

    Serves the rendered PNG thumbnail for a part as image bytes, so a client can fetch it with the
    API key it already holds rather than reading `thumbnailUrl` off `GET /v1/parts/{id}` first.
    The thumbnail is the kernel’s three-quarter view of the analyzed part.

    The bytes are served through this request rather than as a redirect to a presigned URL: a
    thumbnail is a few kB, and streaming it keeps the disclosure on this request’s access audit
    instead of handing out a bearer grant that outlives it. `thumbnailUrl` on the part response is
    still the right choice for an `<img src>`, which cannot carry an Authorization header.

    Resolves the same artifact `GET /v1/parts/{id}` reports — the latest analysis run by default,
    or the run named by `?jobId=`. A part whose analysis produced no thumbnail answers 404.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (str | Unset): Serve the thumbnail from this specific processing run instead of the
            latest result. Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | ProblemDetails
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            job_id=job_id,
        )
    ).parsed
