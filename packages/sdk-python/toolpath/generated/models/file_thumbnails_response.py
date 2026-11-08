from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.file_thumbnail import FileThumbnail


T = TypeVar("T", bound="FileThumbnailsResponse")


@_attrs_define
class FileThumbnailsResponse:
    """
    Attributes:
        file_id (UUID): Identifier of this file.
        job_id (UUID): Identifier of the inspection job that rendered these thumbnails.
        thumbnails (list[FileThumbnail]): Each body that has a thumbnail, in `index` order. Empty when none has:
            rendering is best-effort, and a file inspected before thumbnails has none.
    """

    file_id: UUID
    job_id: UUID
    thumbnails: list[FileThumbnail]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        file_id = str(self.file_id)

        job_id = str(self.job_id)

        thumbnails = []
        for thumbnails_item_data in self.thumbnails:
            thumbnails_item = thumbnails_item_data.to_dict()
            thumbnails.append(thumbnails_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fileId": file_id,
                "jobId": job_id,
                "thumbnails": thumbnails,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.file_thumbnail import FileThumbnail

        d = dict(src_dict)
        file_id = UUID(d.pop("fileId"))

        job_id = UUID(d.pop("jobId"))

        thumbnails = []
        _thumbnails = d.pop("thumbnails")
        for thumbnails_item_data in _thumbnails:
            thumbnails_item = FileThumbnail.from_dict(thumbnails_item_data)

            thumbnails.append(thumbnails_item)

        file_thumbnails_response = cls(
            file_id=file_id,
            job_id=job_id,
            thumbnails=thumbnails,
        )

        file_thumbnails_response.additional_properties = d
        return file_thumbnails_response

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
