from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.part_mesh_job_response import PartMeshJobResponse
from ...models.problem_details import ProblemDetails
from ...types import UNSET, Response, Unset


def _get_kwargs(
    id: str,
    *,
    idempotency_key: str | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/parts/{id}/mesh".format(
            id=quote(str(id), safe=""),
        ),
    }

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PartMeshJobResponse | ProblemDetails | None:
    if response.status_code == 202:
        response_202 = PartMeshJobResponse.from_dict(response.json())

        return response_202

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
) -> Response[PartMeshJobResponse | ProblemDetails]:
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
    idempotency_key: str | Unset = UNSET,
) -> Response[PartMeshJobResponse | ProblemDetails]:
    """Tessellate a part for display

     Queues a job that facets the uploaded CAD file into a display mesh without analyzing it — the fast
    path for a viewer that only needs to draw the part. Poll the job, then read the mesh at GET
    /parts/{id}/mesh. Each run replaces the part’s previous display mesh.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        idempotency_key (str | Unset):  Example: mesh-request-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PartMeshJobResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,
) -> PartMeshJobResponse | ProblemDetails | None:
    """Tessellate a part for display

     Queues a job that facets the uploaded CAD file into a display mesh without analyzing it — the fast
    path for a viewer that only needs to draw the part. Poll the job, then read the mesh at GET
    /parts/{id}/mesh. Each run replaces the part’s previous display mesh.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        idempotency_key (str | Unset):  Example: mesh-request-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PartMeshJobResponse | ProblemDetails
    """

    return sync_detailed(
        id=id,
        client=client,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,
) -> Response[PartMeshJobResponse | ProblemDetails]:
    """Tessellate a part for display

     Queues a job that facets the uploaded CAD file into a display mesh without analyzing it — the fast
    path for a viewer that only needs to draw the part. Poll the job, then read the mesh at GET
    /parts/{id}/mesh. Each run replaces the part’s previous display mesh.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        idempotency_key (str | Unset):  Example: mesh-request-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PartMeshJobResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,
) -> PartMeshJobResponse | ProblemDetails | None:
    """Tessellate a part for display

     Queues a job that facets the uploaded CAD file into a display mesh without analyzing it — the fast
    path for a viewer that only needs to draw the part. Poll the job, then read the mesh at GET
    /parts/{id}/mesh. Each run replaces the part’s previous display mesh.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        idempotency_key (str | Unset):  Example: mesh-request-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PartMeshJobResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            idempotency_key=idempotency_key,
        )
    ).parsed
