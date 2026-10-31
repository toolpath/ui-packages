from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem_details import ProblemDetails
from ...models.update_file_response import UpdateFileResponse
from ...types import UNSET, Response, Unset


def _get_kwargs(
    id: UUID,
    *,
    idempotency_key: str | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/v1/files/{id}".format(
            id=quote(str(id), safe=""),
        ),
    }

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ProblemDetails | UpdateFileResponse | None:
    if response.status_code == 202:
        response_202 = UpdateFileResponse.from_dict(response.json())

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
) -> Response[ProblemDetails | UpdateFileResponse]:
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
    idempotency_key: str | Unset = UNSET,
) -> Response[ProblemDetails | UpdateFileResponse]:
    """Inspect a file

     Queues inspection of an uploaded file — listing its solid bodies — and returns a job. Wait for the
    job with **Stream job updates** (`GET /v1/jobs/{id}/events`), then read the bodies with **Get a
    file** (`GET /v1/files/{id}`). A file holding no solid body fails the job, its `error` beginning
    `no_solid_bodies:`. A file is inspected once: once its bodies are listed they never change, and a
    further inspection is refused. A failed inspection lists nothing, so it can be run again. One
    inspection of a file runs at a time: another, while one is queued or running, is refused.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        idempotency_key (str | Unset):  Example: file-inspection-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | UpdateFileResponse]
    """

    kwargs = _get_kwargs(
        id=id,
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
    idempotency_key: str | Unset = UNSET,
) -> ProblemDetails | UpdateFileResponse | None:
    """Inspect a file

     Queues inspection of an uploaded file — listing its solid bodies — and returns a job. Wait for the
    job with **Stream job updates** (`GET /v1/jobs/{id}/events`), then read the bodies with **Get a
    file** (`GET /v1/files/{id}`). A file holding no solid body fails the job, its `error` beginning
    `no_solid_bodies:`. A file is inspected once: once its bodies are listed they never change, and a
    further inspection is refused. A failed inspection lists nothing, so it can be run again. One
    inspection of a file runs at a time: another, while one is queued or running, is refused.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        idempotency_key (str | Unset):  Example: file-inspection-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | UpdateFileResponse
    """

    return sync_detailed(
        id=id,
        client=client,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,
) -> Response[ProblemDetails | UpdateFileResponse]:
    """Inspect a file

     Queues inspection of an uploaded file — listing its solid bodies — and returns a job. Wait for the
    job with **Stream job updates** (`GET /v1/jobs/{id}/events`), then read the bodies with **Get a
    file** (`GET /v1/files/{id}`). A file holding no solid body fails the job, its `error` beginning
    `no_solid_bodies:`. A file is inspected once: once its bodies are listed they never change, and a
    further inspection is refused. A failed inspection lists nothing, so it can be run again. One
    inspection of a file runs at a time: another, while one is queued or running, is refused.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        idempotency_key (str | Unset):  Example: file-inspection-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | UpdateFileResponse]
    """

    kwargs = _get_kwargs(
        id=id,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,
) -> ProblemDetails | UpdateFileResponse | None:
    """Inspect a file

     Queues inspection of an uploaded file — listing its solid bodies — and returns a job. Wait for the
    job with **Stream job updates** (`GET /v1/jobs/{id}/events`), then read the bodies with **Get a
    file** (`GET /v1/files/{id}`). A file holding no solid body fails the job, its `error` beginning
    `no_solid_bodies:`. A file is inspected once: once its bodies are listed they never change, and a
    further inspection is refused. A failed inspection lists nothing, so it can be run again. One
    inspection of a file runs at a time: another, while one is queued or running, is refused.

    **Experimental.** Available now and still gaining functionality. It may change in breaking ways in a
    minor API release; each such change is listed in the release notes, so check them before upgrading.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        idempotency_key (str | Unset):  Example: file-inspection-123.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | UpdateFileResponse
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            idempotency_key=idempotency_key,
        )
    ).parsed
