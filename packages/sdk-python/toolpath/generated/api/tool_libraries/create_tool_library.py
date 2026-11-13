from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.create_tool_library_response import CreateToolLibraryResponse
from ...models.problem_details import ProblemDetails
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    filename: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["filename"] = filename

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/tool-libraries",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CreateToolLibraryResponse | ProblemDetails | None:
    if response.status_code == 201:
        response_201 = CreateToolLibraryResponse.from_dict(response.json())

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
) -> Response[CreateToolLibraryResponse | ProblemDetails]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    filename: str | Unset = UNSET,
) -> Response[CreateToolLibraryResponse | ProblemDetails]:
    r"""Upload a tool library

     Creates a Fusion tool library and returns a short-lived URL for uploading it: the JSON Fusion writes
    for a library (`ToolLibrary.toJson()`, or `tools.json` inside an exported `.tools`). Upload the file
    to the URL, then name the library in a job’s tool crib as `{ kind: \"fusion\", toolLibraryId,
    presets? }`. Nothing reads the file until a job does: each plan reads it under its crib entry’s
    preset map and prices its tools for the job’s material, and an entry that is not a milling tool is
    listed among the plan’s refused entries rather than failing the job. A library is one upload:
    uploading again once a job has read it is not supported, and the next job is refused with
    `tool_library_source_changed`. Create a new library for a new upload. A library expires 15 days
    after it is created, as a part does.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        filename (str | Unset): Name of the library file you are about to upload, kept as its
            name. Example: shop-tools.json.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateToolLibraryResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        filename=filename,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    filename: str | Unset = UNSET,
) -> CreateToolLibraryResponse | ProblemDetails | None:
    r"""Upload a tool library

     Creates a Fusion tool library and returns a short-lived URL for uploading it: the JSON Fusion writes
    for a library (`ToolLibrary.toJson()`, or `tools.json` inside an exported `.tools`). Upload the file
    to the URL, then name the library in a job’s tool crib as `{ kind: \"fusion\", toolLibraryId,
    presets? }`. Nothing reads the file until a job does: each plan reads it under its crib entry’s
    preset map and prices its tools for the job’s material, and an entry that is not a milling tool is
    listed among the plan’s refused entries rather than failing the job. A library is one upload:
    uploading again once a job has read it is not supported, and the next job is refused with
    `tool_library_source_changed`. Create a new library for a new upload. A library expires 15 days
    after it is created, as a part does.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        filename (str | Unset): Name of the library file you are about to upload, kept as its
            name. Example: shop-tools.json.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateToolLibraryResponse | ProblemDetails
    """

    return sync_detailed(
        client=client,
        filename=filename,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    filename: str | Unset = UNSET,
) -> Response[CreateToolLibraryResponse | ProblemDetails]:
    r"""Upload a tool library

     Creates a Fusion tool library and returns a short-lived URL for uploading it: the JSON Fusion writes
    for a library (`ToolLibrary.toJson()`, or `tools.json` inside an exported `.tools`). Upload the file
    to the URL, then name the library in a job’s tool crib as `{ kind: \"fusion\", toolLibraryId,
    presets? }`. Nothing reads the file until a job does: each plan reads it under its crib entry’s
    preset map and prices its tools for the job’s material, and an entry that is not a milling tool is
    listed among the plan’s refused entries rather than failing the job. A library is one upload:
    uploading again once a job has read it is not supported, and the next job is refused with
    `tool_library_source_changed`. Create a new library for a new upload. A library expires 15 days
    after it is created, as a part does.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        filename (str | Unset): Name of the library file you are about to upload, kept as its
            name. Example: shop-tools.json.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateToolLibraryResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        filename=filename,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    filename: str | Unset = UNSET,
) -> CreateToolLibraryResponse | ProblemDetails | None:
    r"""Upload a tool library

     Creates a Fusion tool library and returns a short-lived URL for uploading it: the JSON Fusion writes
    for a library (`ToolLibrary.toJson()`, or `tools.json` inside an exported `.tools`). Upload the file
    to the URL, then name the library in a job’s tool crib as `{ kind: \"fusion\", toolLibraryId,
    presets? }`. Nothing reads the file until a job does: each plan reads it under its crib entry’s
    preset map and prices its tools for the job’s material, and an entry that is not a milling tool is
    listed among the plan’s refused entries rather than failing the job. A library is one upload:
    uploading again once a job has read it is not supported, and the next job is refused with
    `tool_library_source_changed`. Create a new library for a new upload. A library expires 15 days
    after it is created, as a part does.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        filename (str | Unset): Name of the library file you are about to upload, kept as its
            name. Example: shop-tools.json.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateToolLibraryResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            client=client,
            filename=filename,
        )
    ).parsed
