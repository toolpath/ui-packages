from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.part_mesh_response import PartMeshResponse
from ...models.problem_details import ProblemDetails
from ...types import UNSET, Response, Unset


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
        "url": "/v1/parts/{id}/mesh".format(
            id=quote(str(id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PartMeshResponse | ProblemDetails | None:
    if response.status_code == 200:
        response_200 = PartMeshResponse.from_dict(response.json())

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
) -> Response[PartMeshResponse | ProblemDetails]:
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
) -> Response[PartMeshResponse | ProblemDetails]:
    """Get part mesh

     Returns the display mesh the latest tessellation job wrote for this part. Requires **Tessellate a
    part for display** (`POST /parts/{id}/mesh`) to have run and its job to have succeeded. It is
    faceted from the uploaded file as-is, so it is not the analysis mesh: its counts differ from the
    part result’s, and region triangle ranges do not apply to it. Its own face spans come with it as
    `faceTriangleCounts`. 410 once the part is past the retention window.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (str | Unset): Only return the mesh if this tessellation job produced it; a part
            whose latest mesh came from another run is reported as not found. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PartMeshResponse | ProblemDetails]
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
) -> PartMeshResponse | ProblemDetails | None:
    """Get part mesh

     Returns the display mesh the latest tessellation job wrote for this part. Requires **Tessellate a
    part for display** (`POST /parts/{id}/mesh`) to have run and its job to have succeeded. It is
    faceted from the uploaded file as-is, so it is not the analysis mesh: its counts differ from the
    part result’s, and region triangle ranges do not apply to it. Its own face spans come with it as
    `faceTriangleCounts`. 410 once the part is past the retention window.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (str | Unset): Only return the mesh if this tessellation job produced it; a part
            whose latest mesh came from another run is reported as not found. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PartMeshResponse | ProblemDetails
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
) -> Response[PartMeshResponse | ProblemDetails]:
    """Get part mesh

     Returns the display mesh the latest tessellation job wrote for this part. Requires **Tessellate a
    part for display** (`POST /parts/{id}/mesh`) to have run and its job to have succeeded. It is
    faceted from the uploaded file as-is, so it is not the analysis mesh: its counts differ from the
    part result’s, and region triangle ranges do not apply to it. Its own face spans come with it as
    `faceTriangleCounts`. 410 once the part is past the retention window.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (str | Unset): Only return the mesh if this tessellation job produced it; a part
            whose latest mesh came from another run is reported as not found. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PartMeshResponse | ProblemDetails]
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
) -> PartMeshResponse | ProblemDetails | None:
    """Get part mesh

     Returns the display mesh the latest tessellation job wrote for this part. Requires **Tessellate a
    part for display** (`POST /parts/{id}/mesh`) to have run and its job to have succeeded. It is
    faceted from the uploaded file as-is, so it is not the analysis mesh: its counts differ from the
    part result’s, and region triangle ranges do not apply to it. Its own face spans come with it as
    `faceTriangleCounts`. 410 once the part is past the retention window.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (str | Unset): Only return the mesh if this tessellation job produced it; a part
            whose latest mesh came from another run is reported as not found. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PartMeshResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            job_id=job_id,
        )
    ).parsed
