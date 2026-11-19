from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem_details import ProblemDetails
from ...models.tool_library_response import ToolLibraryResponse
from ...types import Response


def _get_kwargs(
    id: UUID,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/tool-libraries/{id}".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ProblemDetails | ToolLibraryResponse | None:
    if response.status_code == 200:
        response_200 = ToolLibraryResponse.from_dict(response.json())

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
) -> Response[ProblemDetails | ToolLibraryResponse]:
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
) -> Response[ProblemDetails | ToolLibraryResponse]:
    """Get a tool library

     Returns a Fusion tool library created with **Upload a tool library**: when it expires, and a short-
    lived URL to download its file as it is stored now, so the entries a plan’s tools name
    (`tools[key].source.entry`) can be read against it. A library uploaded again after a job read it is
    refused by plan requests (`tool_library_source_changed`). A library expires 15 days after it was
    last used by a job, to within a day; `expiresAt` states the moment. Reading it does not extend it.
    410 once it has expired.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | ToolLibraryResponse]
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
) -> ProblemDetails | ToolLibraryResponse | None:
    """Get a tool library

     Returns a Fusion tool library created with **Upload a tool library**: when it expires, and a short-
    lived URL to download its file as it is stored now, so the entries a plan’s tools name
    (`tools[key].source.entry`) can be read against it. A library uploaded again after a job read it is
    refused by plan requests (`tool_library_source_changed`). A library expires 15 days after it was
    last used by a job, to within a day; `expiresAt` states the moment. Reading it does not extend it.
    410 once it has expired.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | ToolLibraryResponse
    """

    return sync_detailed(
        id=id,
        client=client,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> Response[ProblemDetails | ToolLibraryResponse]:
    """Get a tool library

     Returns a Fusion tool library created with **Upload a tool library**: when it expires, and a short-
    lived URL to download its file as it is stored now, so the entries a plan’s tools name
    (`tools[key].source.entry`) can be read against it. A library uploaded again after a job read it is
    refused by plan requests (`tool_library_source_changed`). A library expires 15 days after it was
    last used by a job, to within a day; `expiresAt` states the moment. Reading it does not extend it.
    410 once it has expired.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | ToolLibraryResponse]
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
) -> ProblemDetails | ToolLibraryResponse | None:
    """Get a tool library

     Returns a Fusion tool library created with **Upload a tool library**: when it expires, and a short-
    lived URL to download its file as it is stored now, so the entries a plan’s tools name
    (`tools[key].source.entry`) can be read against it. A library uploaded again after a job read it is
    refused by plan requests (`tool_library_source_changed`). A library expires 15 days after it was
    last used by a job, to within a day; `expiresAt` states the moment. Reading it does not extend it.
    410 once it has expired.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | ToolLibraryResponse
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
