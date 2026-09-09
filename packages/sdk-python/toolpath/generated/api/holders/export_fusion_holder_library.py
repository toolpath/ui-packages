from http import HTTPStatus
from typing import Any, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.export_fusion_holder_library_trim import ExportFusionHolderLibraryTrim
from ...models.problem_details import ProblemDetails
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    ids: str,
    trim: ExportFusionHolderLibraryTrim | Unset = ExportFusionHolderLibraryTrim.TRUE,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["ids"] = ids

    json_trim: str | Unset = UNSET
    if not isinstance(trim, Unset):
        json_trim = trim.value

    params["trim"] = json_trim

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/holder-libraries/fusion",
        "params": params,
    }

    return _kwargs


def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ProblemDetails | str | None:
    if response.status_code == 200:
        response_200 = cast(str, response.json())
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
) -> Response[ProblemDetails | str]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    ids: str,
    trim: ExportFusionHolderLibraryTrim | Unset = ExportFusionHolderLibraryTrim.TRUE,
) -> Response[ProblemDetails | str]:
    """Export several holders as one Autodesk Fusion library

     Composes the named holders into a single Autodesk Fusion tool library — how a shop keeps its crib
    in one file. Each holder must already have been imported; this reads their stored results and
    creates nothing.

    Holders appear in the order they were named, and a repeated id is exported once. Each entry
    takes its name from the holder’s uploaded filename.

    Every named holder has to be exportable. A holder that does not exist, or that has no import
    result yet, fails the whole request and is named in the response — a library that silently
    contained fewer holders than were asked for would be worse than an error.

    Args:
        ids (str): Comma-separated holder ids, at most 200. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820,0195f02c-4b4a-7b5d-9b6e-8f139d5e2821.
        trim (ExportFusionHolderLibraryTrim | Unset): Serve every envelope cut at its gauge plane.
            Defaults to true, falling back per holder to the complete envelope where there was no
            gauge plane to cut at. Both variants are the kernel’s own output. Default:
            ExportFusionHolderLibraryTrim.TRUE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | str]
    """

    kwargs = _get_kwargs(
        ids=ids,
        trim=trim,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    ids: str,
    trim: ExportFusionHolderLibraryTrim | Unset = ExportFusionHolderLibraryTrim.TRUE,
) -> ProblemDetails | str | None:
    """Export several holders as one Autodesk Fusion library

     Composes the named holders into a single Autodesk Fusion tool library — how a shop keeps its crib
    in one file. Each holder must already have been imported; this reads their stored results and
    creates nothing.

    Holders appear in the order they were named, and a repeated id is exported once. Each entry
    takes its name from the holder’s uploaded filename.

    Every named holder has to be exportable. A holder that does not exist, or that has no import
    result yet, fails the whole request and is named in the response — a library that silently
    contained fewer holders than were asked for would be worse than an error.

    Args:
        ids (str): Comma-separated holder ids, at most 200. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820,0195f02c-4b4a-7b5d-9b6e-8f139d5e2821.
        trim (ExportFusionHolderLibraryTrim | Unset): Serve every envelope cut at its gauge plane.
            Defaults to true, falling back per holder to the complete envelope where there was no
            gauge plane to cut at. Both variants are the kernel’s own output. Default:
            ExportFusionHolderLibraryTrim.TRUE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | str
    """

    return sync_detailed(
        client=client,
        ids=ids,
        trim=trim,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    ids: str,
    trim: ExportFusionHolderLibraryTrim | Unset = ExportFusionHolderLibraryTrim.TRUE,
) -> Response[ProblemDetails | str]:
    """Export several holders as one Autodesk Fusion library

     Composes the named holders into a single Autodesk Fusion tool library — how a shop keeps its crib
    in one file. Each holder must already have been imported; this reads their stored results and
    creates nothing.

    Holders appear in the order they were named, and a repeated id is exported once. Each entry
    takes its name from the holder’s uploaded filename.

    Every named holder has to be exportable. A holder that does not exist, or that has no import
    result yet, fails the whole request and is named in the response — a library that silently
    contained fewer holders than were asked for would be worse than an error.

    Args:
        ids (str): Comma-separated holder ids, at most 200. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820,0195f02c-4b4a-7b5d-9b6e-8f139d5e2821.
        trim (ExportFusionHolderLibraryTrim | Unset): Serve every envelope cut at its gauge plane.
            Defaults to true, falling back per holder to the complete envelope where there was no
            gauge plane to cut at. Both variants are the kernel’s own output. Default:
            ExportFusionHolderLibraryTrim.TRUE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | str]
    """

    kwargs = _get_kwargs(
        ids=ids,
        trim=trim,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    ids: str,
    trim: ExportFusionHolderLibraryTrim | Unset = ExportFusionHolderLibraryTrim.TRUE,
) -> ProblemDetails | str | None:
    """Export several holders as one Autodesk Fusion library

     Composes the named holders into a single Autodesk Fusion tool library — how a shop keeps its crib
    in one file. Each holder must already have been imported; this reads their stored results and
    creates nothing.

    Holders appear in the order they were named, and a repeated id is exported once. Each entry
    takes its name from the holder’s uploaded filename.

    Every named holder has to be exportable. A holder that does not exist, or that has no import
    result yet, fails the whole request and is named in the response — a library that silently
    contained fewer holders than were asked for would be worse than an error.

    Args:
        ids (str): Comma-separated holder ids, at most 200. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820,0195f02c-4b4a-7b5d-9b6e-8f139d5e2821.
        trim (ExportFusionHolderLibraryTrim | Unset): Serve every envelope cut at its gauge plane.
            Defaults to true, falling back per holder to the complete envelope where there was no
            gauge plane to cut at. Both variants are the kernel’s own output. Default:
            ExportFusionHolderLibraryTrim.TRUE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | str
    """

    return (
        await asyncio_detailed(
            client=client,
            ids=ids,
            trim=trim,
        )
    ).parsed
