from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.create_file_parts_request import CreateFilePartsRequest
from ...models.create_file_parts_response import CreateFilePartsResponse
from ...models.problem_details import ProblemDetails
from ...types import Response


def _get_kwargs(
    id: UUID,
    *,
    body: CreateFilePartsRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/files/{id}/parts".format(
            id=quote(str(id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CreateFilePartsResponse | ProblemDetails | None:
    if response.status_code == 201:
        response_201 = CreateFilePartsResponse.from_dict(response.json())

        return response_201

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

    if response.status_code == 409:
        response_409 = ProblemDetails.from_dict(response.json())

        return response_409

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
) -> Response[CreateFilePartsResponse | ProblemDetails]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateFilePartsRequest,
) -> Response[CreateFilePartsResponse | ProblemDetails]:
    """Make parts from a file

     Makes a part of each named body of an inspected file. Each part is an ordinary part from then on:
    run **Analyze a part** (`PATCH /v1/parts/{id}`) and the rest of the pipeline on it, as on an
    uploaded one. Naming a body that is already a part returns that part rather than making another, so
    one call can make every part of a file, or calls can make them one at a time. Name only the bodies
    to machine. Each part comes back with the shape its body is (the file’s `shapes`), so a client can
    make one part of a shape and quote it by the shape’s `count`; nothing stops it making a part of
    every copy. The body a part is cut from is stated as stock with each part’s plan, not here.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        body (CreateFilePartsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateFilePartsResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateFilePartsRequest,
) -> CreateFilePartsResponse | ProblemDetails | None:
    """Make parts from a file

     Makes a part of each named body of an inspected file. Each part is an ordinary part from then on:
    run **Analyze a part** (`PATCH /v1/parts/{id}`) and the rest of the pipeline on it, as on an
    uploaded one. Naming a body that is already a part returns that part rather than making another, so
    one call can make every part of a file, or calls can make them one at a time. Name only the bodies
    to machine. Each part comes back with the shape its body is (the file’s `shapes`), so a client can
    make one part of a shape and quote it by the shape’s `count`; nothing stops it making a part of
    every copy. The body a part is cut from is stated as stock with each part’s plan, not here.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        body (CreateFilePartsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateFilePartsResponse | ProblemDetails
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateFilePartsRequest,
) -> Response[CreateFilePartsResponse | ProblemDetails]:
    """Make parts from a file

     Makes a part of each named body of an inspected file. Each part is an ordinary part from then on:
    run **Analyze a part** (`PATCH /v1/parts/{id}`) and the rest of the pipeline on it, as on an
    uploaded one. Naming a body that is already a part returns that part rather than making another, so
    one call can make every part of a file, or calls can make them one at a time. Name only the bodies
    to machine. Each part comes back with the shape its body is (the file’s `shapes`), so a client can
    make one part of a shape and quote it by the shape’s `count`; nothing stops it making a part of
    every copy. The body a part is cut from is stated as stock with each part’s plan, not here.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        body (CreateFilePartsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateFilePartsResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateFilePartsRequest,
) -> CreateFilePartsResponse | ProblemDetails | None:
    """Make parts from a file

     Makes a part of each named body of an inspected file. Each part is an ordinary part from then on:
    run **Analyze a part** (`PATCH /v1/parts/{id}`) and the rest of the pipeline on it, as on an
    uploaded one. Naming a body that is already a part returns that part rather than making another, so
    one call can make every part of a file, or calls can make them one at a time. Name only the bodies
    to machine. Each part comes back with the shape its body is (the file’s `shapes`), so a client can
    make one part of a shape and quote it by the shape’s `count`; nothing stops it making a part of
    every copy. The body a part is cut from is stated as stock with each part’s plan, not here.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        body (CreateFilePartsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateFilePartsResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
