from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.download_holder_fusion_format import DownloadHolderFusionFormat
from ...models.download_holder_fusion_trim import DownloadHolderFusionTrim
from ...models.problem_details import ProblemDetails
from ...types import UNSET, Response, Unset


def _get_kwargs(
    id: UUID,
    *,
    job_id: UUID | Unset = UNSET,
    format_: DownloadHolderFusionFormat | Unset = DownloadHolderFusionFormat.LIBRARY,
    trim: DownloadHolderFusionTrim | Unset = DownloadHolderFusionTrim.TRUE,
    description: str | Unset = UNSET,
    vendor: str | Unset = UNSET,
    product_id: str | Unset = UNSET,
    product_link: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_job_id: str | Unset = UNSET
    if not isinstance(job_id, Unset):
        json_job_id = str(job_id)
    params["jobId"] = json_job_id

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_

    json_trim: str | Unset = UNSET
    if not isinstance(trim, Unset):
        json_trim = trim.value

    params["trim"] = json_trim

    params["description"] = description

    params["vendor"] = vendor

    params["productId"] = product_id

    params["productLink"] = product_link

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/holders/{id}/fusion".format(
            id=quote(str(id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ProblemDetails | str | None:
    if response.status_code == 200:
        response_200 = cast(str, response.json())
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
) -> Response[ProblemDetails | str]:
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
    job_id: UUID | Unset = UNSET,
    format_: DownloadHolderFusionFormat | Unset = DownloadHolderFusionFormat.LIBRARY,
    trim: DownloadHolderFusionTrim | Unset = DownloadHolderFusionTrim.TRUE,
    description: str | Unset = UNSET,
    vendor: str | Unset = UNSET,
    product_id: str | Unset = UNSET,
    product_link: str | Unset = UNSET,
) -> Response[ProblemDetails | str]:
    """Download the Autodesk Fusion holder definition

     Returns the derived holder as Autodesk Fusion writes one: millimetres, segments nose-first,
    hyphenated keys.

    By default this is a **tool library** (`format=library`) that Fusion can import directly.
    `format=document` returns the bare holder document the kernel wrote, which carries the same
    geometry but cannot be imported on its own.

    The exported envelope stops at the gauge plane by default: material above it is inside the
    spindle and cannot collide with anything. Pass `trim=false` for the complete envelope,
    including the taper. Both are written by the kernel during the import, so neither is a
    reshaping of the other. `trim=true` falls back to the complete envelope for a holder that has
    no gauge plane to cut at, or whose taper a flip put at the nose.

    An unmeasured gauge length is not written as zero. In a library it becomes the sum of every
    segment height — Fusion's own idiom for a holder whose geometry is its gauge length; in a
    document the field is omitted, which puts Fusion's own field into manual mode.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (UUID | Unset): Download the definition from this specific import run instead of
            the latest result.
        format_ (DownloadHolderFusionFormat | Unset): `library` (default) returns an importable
            Fusion tool library; `document` returns the bare holder document written by the kernel.
            Default: DownloadHolderFusionFormat.LIBRARY.
        trim (DownloadHolderFusionTrim | Unset): Serve the envelope cut at the gauge plane.
            Defaults to true, and falls back to the complete envelope when the holder has none. Both
            variants are the kernel’s own output. Default: DownloadHolderFusionTrim.TRUE.
        description (str | Unset): Name for the holder in the library. Defaults to the uploaded
            filename without its extension, then to the holder id.
        vendor (str | Unset): Library vendor field.
        product_id (str | Unset): Library product-id field.
        product_link (str | Unset): Library product-link field.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | str]
    """

    kwargs = _get_kwargs(
        id=id,
        job_id=job_id,
        format_=format_,
        trim=trim,
        description=description,
        vendor=vendor,
        product_id=product_id,
        product_link=product_link,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    job_id: UUID | Unset = UNSET,
    format_: DownloadHolderFusionFormat | Unset = DownloadHolderFusionFormat.LIBRARY,
    trim: DownloadHolderFusionTrim | Unset = DownloadHolderFusionTrim.TRUE,
    description: str | Unset = UNSET,
    vendor: str | Unset = UNSET,
    product_id: str | Unset = UNSET,
    product_link: str | Unset = UNSET,
) -> ProblemDetails | str | None:
    """Download the Autodesk Fusion holder definition

     Returns the derived holder as Autodesk Fusion writes one: millimetres, segments nose-first,
    hyphenated keys.

    By default this is a **tool library** (`format=library`) that Fusion can import directly.
    `format=document` returns the bare holder document the kernel wrote, which carries the same
    geometry but cannot be imported on its own.

    The exported envelope stops at the gauge plane by default: material above it is inside the
    spindle and cannot collide with anything. Pass `trim=false` for the complete envelope,
    including the taper. Both are written by the kernel during the import, so neither is a
    reshaping of the other. `trim=true` falls back to the complete envelope for a holder that has
    no gauge plane to cut at, or whose taper a flip put at the nose.

    An unmeasured gauge length is not written as zero. In a library it becomes the sum of every
    segment height — Fusion's own idiom for a holder whose geometry is its gauge length; in a
    document the field is omitted, which puts Fusion's own field into manual mode.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (UUID | Unset): Download the definition from this specific import run instead of
            the latest result.
        format_ (DownloadHolderFusionFormat | Unset): `library` (default) returns an importable
            Fusion tool library; `document` returns the bare holder document written by the kernel.
            Default: DownloadHolderFusionFormat.LIBRARY.
        trim (DownloadHolderFusionTrim | Unset): Serve the envelope cut at the gauge plane.
            Defaults to true, and falls back to the complete envelope when the holder has none. Both
            variants are the kernel’s own output. Default: DownloadHolderFusionTrim.TRUE.
        description (str | Unset): Name for the holder in the library. Defaults to the uploaded
            filename without its extension, then to the holder id.
        vendor (str | Unset): Library vendor field.
        product_id (str | Unset): Library product-id field.
        product_link (str | Unset): Library product-link field.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | str
    """

    return sync_detailed(
        id=id,
        client=client,
        job_id=job_id,
        format_=format_,
        trim=trim,
        description=description,
        vendor=vendor,
        product_id=product_id,
        product_link=product_link,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    job_id: UUID | Unset = UNSET,
    format_: DownloadHolderFusionFormat | Unset = DownloadHolderFusionFormat.LIBRARY,
    trim: DownloadHolderFusionTrim | Unset = DownloadHolderFusionTrim.TRUE,
    description: str | Unset = UNSET,
    vendor: str | Unset = UNSET,
    product_id: str | Unset = UNSET,
    product_link: str | Unset = UNSET,
) -> Response[ProblemDetails | str]:
    """Download the Autodesk Fusion holder definition

     Returns the derived holder as Autodesk Fusion writes one: millimetres, segments nose-first,
    hyphenated keys.

    By default this is a **tool library** (`format=library`) that Fusion can import directly.
    `format=document` returns the bare holder document the kernel wrote, which carries the same
    geometry but cannot be imported on its own.

    The exported envelope stops at the gauge plane by default: material above it is inside the
    spindle and cannot collide with anything. Pass `trim=false` for the complete envelope,
    including the taper. Both are written by the kernel during the import, so neither is a
    reshaping of the other. `trim=true` falls back to the complete envelope for a holder that has
    no gauge plane to cut at, or whose taper a flip put at the nose.

    An unmeasured gauge length is not written as zero. In a library it becomes the sum of every
    segment height — Fusion's own idiom for a holder whose geometry is its gauge length; in a
    document the field is omitted, which puts Fusion's own field into manual mode.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (UUID | Unset): Download the definition from this specific import run instead of
            the latest result.
        format_ (DownloadHolderFusionFormat | Unset): `library` (default) returns an importable
            Fusion tool library; `document` returns the bare holder document written by the kernel.
            Default: DownloadHolderFusionFormat.LIBRARY.
        trim (DownloadHolderFusionTrim | Unset): Serve the envelope cut at the gauge plane.
            Defaults to true, and falls back to the complete envelope when the holder has none. Both
            variants are the kernel’s own output. Default: DownloadHolderFusionTrim.TRUE.
        description (str | Unset): Name for the holder in the library. Defaults to the uploaded
            filename without its extension, then to the holder id.
        vendor (str | Unset): Library vendor field.
        product_id (str | Unset): Library product-id field.
        product_link (str | Unset): Library product-link field.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ProblemDetails | str]
    """

    kwargs = _get_kwargs(
        id=id,
        job_id=job_id,
        format_=format_,
        trim=trim,
        description=description,
        vendor=vendor,
        product_id=product_id,
        product_link=product_link,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    job_id: UUID | Unset = UNSET,
    format_: DownloadHolderFusionFormat | Unset = DownloadHolderFusionFormat.LIBRARY,
    trim: DownloadHolderFusionTrim | Unset = DownloadHolderFusionTrim.TRUE,
    description: str | Unset = UNSET,
    vendor: str | Unset = UNSET,
    product_id: str | Unset = UNSET,
    product_link: str | Unset = UNSET,
) -> ProblemDetails | str | None:
    """Download the Autodesk Fusion holder definition

     Returns the derived holder as Autodesk Fusion writes one: millimetres, segments nose-first,
    hyphenated keys.

    By default this is a **tool library** (`format=library`) that Fusion can import directly.
    `format=document` returns the bare holder document the kernel wrote, which carries the same
    geometry but cannot be imported on its own.

    The exported envelope stops at the gauge plane by default: material above it is inside the
    spindle and cannot collide with anything. Pass `trim=false` for the complete envelope,
    including the taper. Both are written by the kernel during the import, so neither is a
    reshaping of the other. `trim=true` falls back to the complete envelope for a holder that has
    no gauge plane to cut at, or whose taper a flip put at the nose.

    An unmeasured gauge length is not written as zero. In a library it becomes the sum of every
    segment height — Fusion's own idiom for a holder whose geometry is its gauge length; in a
    document the field is omitted, which puts Fusion's own field into manual mode.

    Args:
        id (UUID):  Example: 0195f02c-4b4a-7b5d-9b6e-8f139d5e2820.
        job_id (UUID | Unset): Download the definition from this specific import run instead of
            the latest result.
        format_ (DownloadHolderFusionFormat | Unset): `library` (default) returns an importable
            Fusion tool library; `document` returns the bare holder document written by the kernel.
            Default: DownloadHolderFusionFormat.LIBRARY.
        trim (DownloadHolderFusionTrim | Unset): Serve the envelope cut at the gauge plane.
            Defaults to true, and falls back to the complete envelope when the holder has none. Both
            variants are the kernel’s own output. Default: DownloadHolderFusionTrim.TRUE.
        description (str | Unset): Name for the holder in the library. Defaults to the uploaded
            filename without its extension, then to the holder id.
        vendor (str | Unset): Library vendor field.
        product_id (str | Unset): Library product-id field.
        product_link (str | Unset): Library product-link field.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ProblemDetails | str
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            job_id=job_id,
            format_=format_,
            trim=trim,
            description=description,
            vendor=vendor,
            product_id=product_id,
            product_link=product_link,
        )
    ).parsed
