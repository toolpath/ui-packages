from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.create_part_response import CreatePartResponse
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
        "url": "/v1/parts",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CreatePartResponse | ProblemDetails | None:
    if response.status_code == 201:
        response_201 = CreatePartResponse.from_dict(response.json())

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
) -> Response[CreatePartResponse | ProblemDetails]:
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
) -> Response[CreatePartResponse | ProblemDetails]:
    """Create a part upload

    Args:
        filename (str | Unset): Name of the CAD file you are about to upload. The extension
            selects the reader, so it must match the file you send: `.step`/`.stp`, `.x_t`/`.x_b`,
            `.sldprt`, `.catpart`, `.prt`, or `.igs`/`.iges`. Omitting it stores the upload as
            `.step`, which fails processing for any other format. Example: part.step.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreatePartResponse | ProblemDetails]
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
) -> CreatePartResponse | ProblemDetails | None:
    """Create a part upload

    Args:
        filename (str | Unset): Name of the CAD file you are about to upload. The extension
            selects the reader, so it must match the file you send: `.step`/`.stp`, `.x_t`/`.x_b`,
            `.sldprt`, `.catpart`, `.prt`, or `.igs`/`.iges`. Omitting it stores the upload as
            `.step`, which fails processing for any other format. Example: part.step.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreatePartResponse | ProblemDetails
    """

    return sync_detailed(
        client=client,
        filename=filename,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    filename: str | Unset = UNSET,
) -> Response[CreatePartResponse | ProblemDetails]:
    """Create a part upload

    Args:
        filename (str | Unset): Name of the CAD file you are about to upload. The extension
            selects the reader, so it must match the file you send: `.step`/`.stp`, `.x_t`/`.x_b`,
            `.sldprt`, `.catpart`, `.prt`, or `.igs`/`.iges`. Omitting it stores the upload as
            `.step`, which fails processing for any other format. Example: part.step.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreatePartResponse | ProblemDetails]
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
) -> CreatePartResponse | ProblemDetails | None:
    """Create a part upload

    Args:
        filename (str | Unset): Name of the CAD file you are about to upload. The extension
            selects the reader, so it must match the file you send: `.step`/`.stp`, `.x_t`/`.x_b`,
            `.sldprt`, `.catpart`, `.prt`, or `.igs`/`.iges`. Omitting it stores the upload as
            `.step`, which fails processing for any other format. Example: part.step.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreatePartResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            client=client,
            filename=filename,
        )
    ).parsed
