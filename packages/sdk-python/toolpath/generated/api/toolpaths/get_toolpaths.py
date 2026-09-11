from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.pipeline_readiness_problem import PipelineReadinessProblem
from ...models.problem_details import ProblemDetails
from ...models.toolpaths_response import ToolpathsResponse
from ...types import Response


def _get_kwargs(
    plan_id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/plans/{plan_id}/toolpaths".format(
            plan_id=quote(str(plan_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PipelineReadinessProblem | ProblemDetails | ToolpathsResponse | None:
    if response.status_code == 200:
        response_200 = ToolpathsResponse.from_dict(response.json())

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
        response_409 = PipelineReadinessProblem.from_dict(response.json())

        return response_409

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
) -> Response[PipelineReadinessProblem | ProblemDetails | ToolpathsResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    plan_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[PipelineReadinessProblem | ProblemDetails | ToolpathsResponse]:
    """Get toolpaths

     Returns the calculated toolpaths for a plan, with geometry download URLs. Requires **Calculate
    toolpaths** (`POST /parts/{id}/toolpaths`) or **Recalculate toolpaths** (`POST
    /plans/{planId}/toolpaths`) to have run and its job to have succeeded.

    **Early access.** Machining plans and toolpath calculation are available now but still gaining
    functionality — planned additions include plan constraints and specifying material and stock, among
    others. Breaking changes still follow the API major version, so you can build against them today;
    expect new capabilities to arrive as they mature.

    Args:
        plan_id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PipelineReadinessProblem | ProblemDetails | ToolpathsResponse]
    """

    kwargs = _get_kwargs(
        plan_id=plan_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    plan_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> PipelineReadinessProblem | ProblemDetails | ToolpathsResponse | None:
    """Get toolpaths

     Returns the calculated toolpaths for a plan, with geometry download URLs. Requires **Calculate
    toolpaths** (`POST /parts/{id}/toolpaths`) or **Recalculate toolpaths** (`POST
    /plans/{planId}/toolpaths`) to have run and its job to have succeeded.

    **Early access.** Machining plans and toolpath calculation are available now but still gaining
    functionality — planned additions include plan constraints and specifying material and stock, among
    others. Breaking changes still follow the API major version, so you can build against them today;
    expect new capabilities to arrive as they mature.

    Args:
        plan_id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PipelineReadinessProblem | ProblemDetails | ToolpathsResponse
    """

    return sync_detailed(
        plan_id=plan_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    plan_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[PipelineReadinessProblem | ProblemDetails | ToolpathsResponse]:
    """Get toolpaths

     Returns the calculated toolpaths for a plan, with geometry download URLs. Requires **Calculate
    toolpaths** (`POST /parts/{id}/toolpaths`) or **Recalculate toolpaths** (`POST
    /plans/{planId}/toolpaths`) to have run and its job to have succeeded.

    **Early access.** Machining plans and toolpath calculation are available now but still gaining
    functionality — planned additions include plan constraints and specifying material and stock, among
    others. Breaking changes still follow the API major version, so you can build against them today;
    expect new capabilities to arrive as they mature.

    Args:
        plan_id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PipelineReadinessProblem | ProblemDetails | ToolpathsResponse]
    """

    kwargs = _get_kwargs(
        plan_id=plan_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    plan_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> PipelineReadinessProblem | ProblemDetails | ToolpathsResponse | None:
    """Get toolpaths

     Returns the calculated toolpaths for a plan, with geometry download URLs. Requires **Calculate
    toolpaths** (`POST /parts/{id}/toolpaths`) or **Recalculate toolpaths** (`POST
    /plans/{planId}/toolpaths`) to have run and its job to have succeeded.

    **Early access.** Machining plans and toolpath calculation are available now but still gaining
    functionality — planned additions include plan constraints and specifying material and stock, among
    others. Breaking changes still follow the API major version, so you can build against them today;
    expect new capabilities to arrive as they mature.

    Args:
        plan_id (str):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PipelineReadinessProblem | ProblemDetails | ToolpathsResponse
    """

    return (
        await asyncio_detailed(
            plan_id=plan_id,
            client=client,
        )
    ).parsed
