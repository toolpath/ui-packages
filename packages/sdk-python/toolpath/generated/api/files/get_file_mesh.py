from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.file_mesh_response import FileMeshResponse
from ...models.problem_details import ProblemDetails
from ...types import Response


def _get_kwargs(
    id: UUID,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/files/{id}/mesh".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> FileMeshResponse | ProblemDetails | None:
    if response.status_code == 200:
        response_200 = FileMeshResponse.from_dict(response.json())

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
) -> Response[FileMeshResponse | ProblemDetails]:
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
) -> Response[FileMeshResponse | ProblemDetails]:
    """Get file mesh

     Returns a display mesh of every solid body of a file, written by **Inspect a file** (`PATCH
    /v1/files/{id}`), so the bodies can be drawn before any is made a part. The GLB holds one node per
    body, and node `body-<index>` is the body at `bodies[index]` of **Get a file** (`GET
    /v1/files/{id}`); nodes are named by index only, never by the body’s name. It is faceted from the
    uploaded file as-is, so it is not any part’s analysis mesh. Meshing is best-effort: an inspection
    can list the bodies without one, which `hasMesh` on **Get a file** reports. 409 before an inspection
    has succeeded; 410 once the file is past the retention window.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[FileMeshResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> FileMeshResponse | ProblemDetails | None:
    """Get file mesh

     Returns a display mesh of every solid body of a file, written by **Inspect a file** (`PATCH
    /v1/files/{id}`), so the bodies can be drawn before any is made a part. The GLB holds one node per
    body, and node `body-<index>` is the body at `bodies[index]` of **Get a file** (`GET
    /v1/files/{id}`); nodes are named by index only, never by the body’s name. It is faceted from the
    uploaded file as-is, so it is not any part’s analysis mesh. Meshing is best-effort: an inspection
    can list the bodies without one, which `hasMesh` on **Get a file** reports. 409 before an inspection
    has succeeded; 410 once the file is past the retention window.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        FileMeshResponse | ProblemDetails
    """

    return sync_detailed(
        id=id,
        client=client,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> Response[FileMeshResponse | ProblemDetails]:
    """Get file mesh

     Returns a display mesh of every solid body of a file, written by **Inspect a file** (`PATCH
    /v1/files/{id}`), so the bodies can be drawn before any is made a part. The GLB holds one node per
    body, and node `body-<index>` is the body at `bodies[index]` of **Get a file** (`GET
    /v1/files/{id}`); nodes are named by index only, never by the body’s name. It is faceted from the
    uploaded file as-is, so it is not any part’s analysis mesh. Meshing is best-effort: an inspection
    can list the bodies without one, which `hasMesh` on **Get a file** reports. 409 before an inspection
    has succeeded; 410 once the file is past the retention window.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[FileMeshResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> FileMeshResponse | ProblemDetails | None:
    """Get file mesh

     Returns a display mesh of every solid body of a file, written by **Inspect a file** (`PATCH
    /v1/files/{id}`), so the bodies can be drawn before any is made a part. The GLB holds one node per
    body, and node `body-<index>` is the body at `bodies[index]` of **Get a file** (`GET
    /v1/files/{id}`); nodes are named by index only, never by the body’s name. It is faceted from the
    uploaded file as-is, so it is not any part’s analysis mesh. Meshing is best-effort: an inspection
    can list the bodies without one, which `hasMesh` on **Get a file** reports. 409 before an inspection
    has succeeded; 410 once the file is past the retention window.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        FileMeshResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
