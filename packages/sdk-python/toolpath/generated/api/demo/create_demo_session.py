from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.demo_session_request import DemoSessionRequest
from ...models.demo_session_response import DemoSessionResponse
from ...models.problem_details import ProblemDetails
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    body: DemoSessionRequest | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/demo/session",
    }

    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> DemoSessionResponse | ProblemDetails | None:
    if response.status_code == 201:
        response_201 = DemoSessionResponse.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = ProblemDetails.from_dict(response.json())

        return response_400

    if response.status_code == 429:
        response_429 = ProblemDetails.from_dict(response.json())

        return response_429

    if response.status_code == 503:
        response_503 = ProblemDetails.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[DemoSessionResponse | ProblemDetails]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: DemoSessionRequest | Unset = UNSET,
) -> Response[DemoSessionResponse | ProblemDetails]:
    """Start a temporary demo session

     Issues a short-lived API key for anonymous, no-signup access to a limited set of endpoints. Each
    session is isolated to its own throwaway organization, so it sees only the data it uploaded. Send
    the same `installId` again to renew: the previous key is retired and a new one is issued on the same
    organization.

    Args:
        body (DemoSessionRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DemoSessionResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    body: DemoSessionRequest | Unset = UNSET,
) -> DemoSessionResponse | ProblemDetails | None:
    """Start a temporary demo session

     Issues a short-lived API key for anonymous, no-signup access to a limited set of endpoints. Each
    session is isolated to its own throwaway organization, so it sees only the data it uploaded. Send
    the same `installId` again to renew: the previous key is retired and a new one is issued on the same
    organization.

    Args:
        body (DemoSessionRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DemoSessionResponse | ProblemDetails
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: DemoSessionRequest | Unset = UNSET,
) -> Response[DemoSessionResponse | ProblemDetails]:
    """Start a temporary demo session

     Issues a short-lived API key for anonymous, no-signup access to a limited set of endpoints. Each
    session is isolated to its own throwaway organization, so it sees only the data it uploaded. Send
    the same `installId` again to renew: the previous key is retired and a new one is issued on the same
    organization.

    Args:
        body (DemoSessionRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DemoSessionResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: DemoSessionRequest | Unset = UNSET,
) -> DemoSessionResponse | ProblemDetails | None:
    """Start a temporary demo session

     Issues a short-lived API key for anonymous, no-signup access to a limited set of endpoints. Each
    session is isolated to its own throwaway organization, so it sees only the data it uploaded. Send
    the same `installId` again to renew: the previous key is retired and a new one is issued on the same
    organization.

    Args:
        body (DemoSessionRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DemoSessionResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
