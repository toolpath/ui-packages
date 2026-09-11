from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem_details import ProblemDetails
from ...models.update_part_feature_details import UpdatePartFeatureDetails
from ...models.update_part_response import UpdatePartResponse
from ...types import UNSET, Response, Unset


def _get_kwargs(
    id: str,
    *,
    feature_details: UpdatePartFeatureDetails | Unset = UpdatePartFeatureDetails.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key

    params: dict[str, Any] = {}

    json_feature_details: str | Unset = UNSET
    if not isinstance(feature_details, Unset):
        json_feature_details = feature_details.value

    params["featureDetails"] = json_feature_details

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/v1/parts/{id}".format(
            id=quote(str(id), safe=""),
        ),
        "params": params,
    }

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ProblemDetails | UpdatePartResponse | None:
    if response.status_code == 202:
        response_202 = UpdatePartResponse.from_dict(response.json())

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
) -> Response[ProblemDetails | UpdatePartResponse]:
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
    feature_details: UpdatePartFeatureDetails | Unset = UpdatePartFeatureDetails.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> Response[ProblemDetails | UpdatePartResponse]:
    """Queue part processing

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        feature_details (UpdatePartFeatureDetails | Unset): When true, generate detailed machining
            data for recognized features. Defaults to false. Default: UpdatePartFeatureDetails.FALSE.
            Example: true.
        idempotency_key (str | Unset):  Example: analysis-request-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | UpdatePartResponse]
    """

    kwargs = _get_kwargs(
        id=id,
        feature_details=feature_details,
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
    feature_details: UpdatePartFeatureDetails | Unset = UpdatePartFeatureDetails.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> ProblemDetails | UpdatePartResponse | None:
    """Queue part processing

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        feature_details (UpdatePartFeatureDetails | Unset): When true, generate detailed machining
            data for recognized features. Defaults to false. Default: UpdatePartFeatureDetails.FALSE.
            Example: true.
        idempotency_key (str | Unset):  Example: analysis-request-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | UpdatePartResponse
    """

    return sync_detailed(
        id=id,
        client=client,
        feature_details=feature_details,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    feature_details: UpdatePartFeatureDetails | Unset = UpdatePartFeatureDetails.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> Response[ProblemDetails | UpdatePartResponse]:
    """Queue part processing

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        feature_details (UpdatePartFeatureDetails | Unset): When true, generate detailed machining
            data for recognized features. Defaults to false. Default: UpdatePartFeatureDetails.FALSE.
            Example: true.
        idempotency_key (str | Unset):  Example: analysis-request-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | UpdatePartResponse]
    """

    kwargs = _get_kwargs(
        id=id,
        feature_details=feature_details,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    feature_details: UpdatePartFeatureDetails | Unset = UpdatePartFeatureDetails.FALSE,
    idempotency_key: str | Unset = UNSET,
) -> ProblemDetails | UpdatePartResponse | None:
    """Queue part processing

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        feature_details (UpdatePartFeatureDetails | Unset): When true, generate detailed machining
            data for recognized features. Defaults to false. Default: UpdatePartFeatureDetails.FALSE.
            Example: true.
        idempotency_key (str | Unset):  Example: analysis-request-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | UpdatePartResponse
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            feature_details=feature_details,
            idempotency_key=idempotency_key,
        )
    ).parsed
