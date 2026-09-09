from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.list_jobs_response import ListJobsResponse
from ...models.list_jobs_status import ListJobsStatus
from ...models.problem_details import ProblemDetails
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    page: int | Unset = 1,
    page_size: int | Unset = 20,
    part_id: str | Unset = UNSET,
    holder_id: str | Unset = UNSET,
    status: ListJobsStatus | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["page"] = page

    params["pageSize"] = page_size

    params["partId"] = part_id

    params["holderId"] = holder_id

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/jobs",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ListJobsResponse | ProblemDetails | None:
    if response.status_code == 200:
        response_200 = ListJobsResponse.from_dict(response.json())

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
) -> Response[ListJobsResponse | ProblemDetails]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    page_size: int | Unset = 20,
    part_id: str | Unset = UNSET,
    holder_id: str | Unset = UNSET,
    status: ListJobsStatus | Unset = UNSET,
) -> Response[ListJobsResponse | ProblemDetails]:
    """List jobs

    Args:
        page (int | Unset):  Default: 1. Example: 1.
        page_size (int | Unset): Requested page size. Values above 100 are capped at 100. Default:
            20. Example: 20.
        part_id (str | Unset): Return only jobs for this part. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        holder_id (str | Unset): Return only jobs for this holder. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        status (ListJobsStatus | Unset): Return only jobs in this state. Example: succeeded.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListJobsResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        page=page,
        page_size=page_size,
        part_id=part_id,
        holder_id=holder_id,
        status=status,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    page_size: int | Unset = 20,
    part_id: str | Unset = UNSET,
    holder_id: str | Unset = UNSET,
    status: ListJobsStatus | Unset = UNSET,
) -> ListJobsResponse | ProblemDetails | None:
    """List jobs

    Args:
        page (int | Unset):  Default: 1. Example: 1.
        page_size (int | Unset): Requested page size. Values above 100 are capped at 100. Default:
            20. Example: 20.
        part_id (str | Unset): Return only jobs for this part. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        holder_id (str | Unset): Return only jobs for this holder. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        status (ListJobsStatus | Unset): Return only jobs in this state. Example: succeeded.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListJobsResponse | ProblemDetails
    """

    return sync_detailed(
        client=client,
        page=page,
        page_size=page_size,
        part_id=part_id,
        holder_id=holder_id,
        status=status,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    page_size: int | Unset = 20,
    part_id: str | Unset = UNSET,
    holder_id: str | Unset = UNSET,
    status: ListJobsStatus | Unset = UNSET,
) -> Response[ListJobsResponse | ProblemDetails]:
    """List jobs

    Args:
        page (int | Unset):  Default: 1. Example: 1.
        page_size (int | Unset): Requested page size. Values above 100 are capped at 100. Default:
            20. Example: 20.
        part_id (str | Unset): Return only jobs for this part. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        holder_id (str | Unset): Return only jobs for this holder. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        status (ListJobsStatus | Unset): Return only jobs in this state. Example: succeeded.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListJobsResponse | ProblemDetails]
    """

    kwargs = _get_kwargs(
        page=page,
        page_size=page_size,
        part_id=part_id,
        holder_id=holder_id,
        status=status,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    page_size: int | Unset = 20,
    part_id: str | Unset = UNSET,
    holder_id: str | Unset = UNSET,
    status: ListJobsStatus | Unset = UNSET,
) -> ListJobsResponse | ProblemDetails | None:
    """List jobs

    Args:
        page (int | Unset):  Default: 1. Example: 1.
        page_size (int | Unset): Requested page size. Values above 100 are capped at 100. Default:
            20. Example: 20.
        part_id (str | Unset): Return only jobs for this part. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        holder_id (str | Unset): Return only jobs for this holder. Example:
            0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        status (ListJobsStatus | Unset): Return only jobs in this state. Example: succeeded.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListJobsResponse | ProblemDetails
    """

    return (
        await asyncio_detailed(
            client=client,
            page=page,
            page_size=page_size,
            part_id=part_id,
            holder_id=holder_id,
            status=status,
        )
    ).parsed
