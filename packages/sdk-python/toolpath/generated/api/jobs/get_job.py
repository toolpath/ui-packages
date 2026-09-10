from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.job_detail import JobDetail
from ...models.problem_details import ProblemDetails
from ...types import Response


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/jobs/{id}".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> JobDetail | ProblemDetails | None:
    if response.status_code == 200:
        response_200 = JobDetail.from_dict(response.json())

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
) -> Response[JobDetail | ProblemDetails]:
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
) -> Response[JobDetail | ProblemDetails]:
    """Get a job

     Returns one processing job. After any pipeline step that queues work, poll this (or **Stream job
    updates**, `GET /jobs/{id}/events`) until the status is `succeeded`, then read the result from the
    matching Get endpoint.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[JobDetail | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
) -> JobDetail | ProblemDetails | None:
    """Get a job

     Returns one processing job. After any pipeline step that queues work, poll this (or **Stream job
    updates**, `GET /jobs/{id}/events`) until the status is `succeeded`, then read the result from the
    matching Get endpoint.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        JobDetail | ProblemDetails
    """

    return sync_detailed(
        id=id,
        client=client,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[JobDetail | ProblemDetails]:
    """Get a job

     Returns one processing job. After any pipeline step that queues work, poll this (or **Stream job
    updates**, `GET /jobs/{id}/events`) until the status is `succeeded`, then read the result from the
    matching Get endpoint.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[JobDetail | ProblemDetails]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
) -> JobDetail | ProblemDetails | None:
    """Get a job

     Returns one processing job. After any pipeline step that queues work, poll this (or **Stream job
    updates**, `GET /jobs/{id}/events`) until the status is `succeeded`, then read the result from the
    matching Get endpoint.

    Args:
        id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        JobDetail | ProblemDetails
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
