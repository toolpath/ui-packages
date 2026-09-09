from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.part_features_response import PartFeaturesResponse
from ...models.problem_details import ProblemDetails
from ...types import UNSET, Response


def _get_kwargs(
    id: str,
    *,
    ids: str,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["ids"] = ids

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/parts/{id}/features".format(
            id=quote(str(id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PartFeaturesResponse | ProblemDetails | None:
    if response.status_code == 200:
        response_200 = PartFeaturesResponse.from_dict(response.json())

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
) -> Response[PartFeaturesResponse | ProblemDetails]:
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
    ids: str,
) -> Response[PartFeaturesResponse | ProblemDetails]:
    """Get selected features for a part

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        ids (str): Comma-separated feature ids from the part to fetch detailed machining data for.
            Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820,0195f02c-4b4a-7b5d-9b6e-8f139d5e2821.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PartFeaturesResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
        ids=ids,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    ids: str,
) -> PartFeaturesResponse | ProblemDetails | None:
    """Get selected features for a part

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        ids (str): Comma-separated feature ids from the part to fetch detailed machining data for.
            Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820,0195f02c-4b4a-7b5d-9b6e-8f139d5e2821.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PartFeaturesResponse | ProblemDetails
    """

    return sync_detailed(
        id=id,
        client=client,
        ids=ids,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    ids: str,
) -> Response[PartFeaturesResponse | ProblemDetails]:
    """Get selected features for a part

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        ids (str): Comma-separated feature ids from the part to fetch detailed machining data for.
            Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820,0195f02c-4b4a-7b5d-9b6e-8f139d5e2821.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PartFeaturesResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
        ids=ids,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    ids: str,
) -> PartFeaturesResponse | ProblemDetails | None:
    """Get selected features for a part

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        ids (str): Comma-separated feature ids from the part to fetch detailed machining data for.
            Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820,0195f02c-4b4a-7b5d-9b6e-8f139d5e2821.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PartFeaturesResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            ids=ids,
        )
    ).parsed
