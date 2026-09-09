from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem_details import ProblemDetails
from ...models.update_holder_fill_bays import UpdateHolderFillBays
from ...models.update_holder_flipped import UpdateHolderFlipped
from ...models.update_holder_response import UpdateHolderResponse
from ...types import UNSET, Response, Unset


def _get_kwargs(
    id: UUID,
    *,
    tolerance: float | Unset = 0.05,
    fill_bays: UpdateHolderFillBays | Unset = UpdateHolderFillBays.TRUE,
    flipped: UpdateHolderFlipped | Unset = UpdateHolderFlipped.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key

    params: dict[str, Any] = {}

    params["tolerance"] = tolerance

    json_fill_bays: str | Unset = UNSET
    if not isinstance(fill_bays, Unset):
        json_fill_bays = fill_bays.value

    params["fillBays"] = json_fill_bays

    json_flipped: str | Unset = UNSET
    if not isinstance(flipped, Unset):
        json_flipped = flipped.value

    params["flipped"] = json_flipped

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/v1/holders/{id}".format(
            id=quote(str(id), safe=""),
        ),
        "params": params,
    }

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ProblemDetails | UpdateHolderResponse | None:
    if response.status_code == 202:
        response_202 = UpdateHolderResponse.from_dict(response.json())

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
) -> Response[ProblemDetails | UpdateHolderResponse]:
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
    tolerance: float | Unset = 0.05,
    fill_bays: UpdateHolderFillBays | Unset = UpdateHolderFillBays.TRUE,
    flipped: UpdateHolderFlipped | Unset = UpdateHolderFlipped.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> Response[ProblemDetails | UpdateHolderResponse]:
    """Queue holder import

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        tolerance (float | Unset): Simplification tolerance in mm of radius. Simplification is
            one-sided, so the envelope contains the measured silhouette at any value. Defaults to
            0.05. Default: 0.05. Example: 0.05.
        fill_bays (UpdateHolderFillBays | Unset): Raise each solid's enclosed bays — a V-flange
            groove, a thread relief — to their brims. Adds material nothing can collide with and cuts
            the layer count sharply. Defaults to true. Default: UpdateHolderFillBays.TRUE. Example:
            false.
        flipped (UpdateHolderFlipped | Unset): Turn the holder end for end after the automatic
            orientation, which reads the 7:24 taper and otherwise puts the widest feature at the
            spindle end. Defaults to false. Default: UpdateHolderFlipped.FALSE. Example: true.
        idempotency_key (str | Unset):  Example: holder-import-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | UpdateHolderResponse]
    """

    kwargs = _get_kwargs(
        id=id,
        tolerance=tolerance,
        fill_bays=fill_bays,
        flipped=flipped,
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    tolerance: float | Unset = 0.05,
    fill_bays: UpdateHolderFillBays | Unset = UpdateHolderFillBays.TRUE,
    flipped: UpdateHolderFlipped | Unset = UpdateHolderFlipped.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> ProblemDetails | UpdateHolderResponse | None:
    """Queue holder import

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        tolerance (float | Unset): Simplification tolerance in mm of radius. Simplification is
            one-sided, so the envelope contains the measured silhouette at any value. Defaults to
            0.05. Default: 0.05. Example: 0.05.
        fill_bays (UpdateHolderFillBays | Unset): Raise each solid's enclosed bays — a V-flange
            groove, a thread relief — to their brims. Adds material nothing can collide with and cuts
            the layer count sharply. Defaults to true. Default: UpdateHolderFillBays.TRUE. Example:
            false.
        flipped (UpdateHolderFlipped | Unset): Turn the holder end for end after the automatic
            orientation, which reads the 7:24 taper and otherwise puts the widest feature at the
            spindle end. Defaults to false. Default: UpdateHolderFlipped.FALSE. Example: true.
        idempotency_key (str | Unset):  Example: holder-import-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | UpdateHolderResponse
    """

    return sync_detailed(
        id=id,
        client=client,
        tolerance=tolerance,
        fill_bays=fill_bays,
        flipped=flipped,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    tolerance: float | Unset = 0.05,
    fill_bays: UpdateHolderFillBays | Unset = UpdateHolderFillBays.TRUE,
    flipped: UpdateHolderFlipped | Unset = UpdateHolderFlipped.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> Response[ProblemDetails | UpdateHolderResponse]:
    """Queue holder import

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        tolerance (float | Unset): Simplification tolerance in mm of radius. Simplification is
            one-sided, so the envelope contains the measured silhouette at any value. Defaults to
            0.05. Default: 0.05. Example: 0.05.
        fill_bays (UpdateHolderFillBays | Unset): Raise each solid's enclosed bays — a V-flange
            groove, a thread relief — to their brims. Adds material nothing can collide with and cuts
            the layer count sharply. Defaults to true. Default: UpdateHolderFillBays.TRUE. Example:
            false.
        flipped (UpdateHolderFlipped | Unset): Turn the holder end for end after the automatic
            orientation, which reads the 7:24 taper and otherwise puts the widest feature at the
            spindle end. Defaults to false. Default: UpdateHolderFlipped.FALSE. Example: true.
        idempotency_key (str | Unset):  Example: holder-import-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | UpdateHolderResponse]
    """

    kwargs = _get_kwargs(
        id=id,
        tolerance=tolerance,
        fill_bays=fill_bays,
        flipped=flipped,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    tolerance: float | Unset = 0.05,
    fill_bays: UpdateHolderFillBays | Unset = UpdateHolderFillBays.TRUE,
    flipped: UpdateHolderFlipped | Unset = UpdateHolderFlipped.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> ProblemDetails | UpdateHolderResponse | None:
    """Queue holder import

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        tolerance (float | Unset): Simplification tolerance in mm of radius. Simplification is
            one-sided, so the envelope contains the measured silhouette at any value. Defaults to
            0.05. Default: 0.05. Example: 0.05.
        fill_bays (UpdateHolderFillBays | Unset): Raise each solid's enclosed bays — a V-flange
            groove, a thread relief — to their brims. Adds material nothing can collide with and cuts
            the layer count sharply. Defaults to true. Default: UpdateHolderFillBays.TRUE. Example:
            false.
        flipped (UpdateHolderFlipped | Unset): Turn the holder end for end after the automatic
            orientation, which reads the 7:24 taper and otherwise puts the widest feature at the
            spindle end. Defaults to false. Default: UpdateHolderFlipped.FALSE. Example: true.
        idempotency_key (str | Unset):  Example: holder-import-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | UpdateHolderResponse
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            tolerance=tolerance,
            fill_bays=fill_bays,
            flipped=flipped,
            idempotency_key=idempotency_key,
        )
    ).parsed
