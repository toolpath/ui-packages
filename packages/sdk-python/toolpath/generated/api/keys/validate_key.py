from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.key_validation_response import KeyValidationResponse
from ...models.problem_details import ProblemDetails
from ...types import Response


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/keys/validate",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> KeyValidationResponse | ProblemDetails | None:
    if response.status_code == 200:
        response_200 = KeyValidationResponse.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = KeyValidationResponse.from_dict(response.json())

        return response_401

    if response.status_code == 503:
        response_503 = ProblemDetails.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[KeyValidationResponse | ProblemDetails]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[KeyValidationResponse | ProblemDetails]:
    """Validate an API key

     Reports the status of the API key supplied in the Authorization header. A usable key returns 200; a
    missing, revoked, expired, or unknown key returns 401 — both with a status body (never problem+json)
    — so bring-your-own-key integrations can confirm a key and show why it failed. A 200 additionally
    carries the key's `orgId`, `keyId` and `keyPrefix` when available; a 401 never does.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[KeyValidationResponse | ProblemDetails]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> KeyValidationResponse | ProblemDetails | None:
    """Validate an API key

     Reports the status of the API key supplied in the Authorization header. A usable key returns 200; a
    missing, revoked, expired, or unknown key returns 401 — both with a status body (never problem+json)
    — so bring-your-own-key integrations can confirm a key and show why it failed. A 200 additionally
    carries the key's `orgId`, `keyId` and `keyPrefix` when available; a 401 never does.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        KeyValidationResponse | ProblemDetails
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[KeyValidationResponse | ProblemDetails]:
    """Validate an API key

     Reports the status of the API key supplied in the Authorization header. A usable key returns 200; a
    missing, revoked, expired, or unknown key returns 401 — both with a status body (never problem+json)
    — so bring-your-own-key integrations can confirm a key and show why it failed. A 200 additionally
    carries the key's `orgId`, `keyId` and `keyPrefix` when available; a 401 never does.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[KeyValidationResponse | ProblemDetails]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> KeyValidationResponse | ProblemDetails | None:
    """Validate an API key

     Reports the status of the API key supplied in the Authorization header. A usable key returns 200; a
    missing, revoked, expired, or unknown key returns 401 — both with a status body (never problem+json)
    — so bring-your-own-key integrations can confirm a key and show why it failed. A 200 additionally
    carries the key's `orgId`, `keyId` and `keyPrefix` when available; a 401 never does.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        KeyValidationResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
