from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem_details import ProblemDetails
from ...models.update_part_features_request import UpdatePartFeaturesRequest
from ...models.update_part_features_response import UpdatePartFeaturesResponse
from ...types import UNSET, Response, Unset


def _get_kwargs(
    id: str,
    *,
    body: UpdatePartFeaturesRequest | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/v1/parts/{id}/features".format(
            id=quote(str(id), safe=""),
        ),
    }

    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ProblemDetails | UpdatePartFeaturesResponse | None:
    if response.status_code == 202:
        response_202 = UpdatePartFeaturesResponse.from_dict(response.json())

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
) -> Response[ProblemDetails | UpdatePartFeaturesResponse]:
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
    body: UpdatePartFeaturesRequest | Unset = UNSET,
) -> Response[ProblemDetails | UpdatePartFeaturesResponse]:
    """Queue processing for selected part features

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        body (UpdatePartFeaturesRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | UpdatePartFeaturesResponse]
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
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdatePartFeaturesRequest | Unset = UNSET,
) -> ProblemDetails | UpdatePartFeaturesResponse | None:
    """Queue processing for selected part features

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        body (UpdatePartFeaturesRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | UpdatePartFeaturesResponse
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdatePartFeaturesRequest | Unset = UNSET,
) -> Response[ProblemDetails | UpdatePartFeaturesResponse]:
    """Queue processing for selected part features

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        body (UpdatePartFeaturesRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | UpdatePartFeaturesResponse]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdatePartFeaturesRequest | Unset = UNSET,
) -> ProblemDetails | UpdatePartFeaturesResponse | None:
    """Queue processing for selected part features

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        body (UpdatePartFeaturesRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | UpdatePartFeaturesResponse
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
