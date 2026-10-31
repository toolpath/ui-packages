from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="CreateFileResponse")


@_attrs_define
class CreateFileResponse:
    """
    Attributes:
        file_id (UUID): Identifier of the newly created file.
        upload_url (str): Short-lived URL that accepts a direct upload of the CAD file.
        source_bucket (str): Object-storage bucket receiving the CAD file.
        source_s3_key (str): Object-storage key assigned to the CAD file.
    """

    file_id: UUID
    upload_url: str
    source_bucket: str
    source_s3_key: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        file_id = str(self.file_id)

        upload_url = self.upload_url

        source_bucket = self.source_bucket

        source_s3_key = self.source_s3_key

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fileId": file_id,
                "uploadUrl": upload_url,
                "sourceBucket": source_bucket,
                "sourceS3Key": source_s3_key,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        file_id = UUID(d.pop("fileId"))

        upload_url = d.pop("uploadUrl")

        source_bucket = d.pop("sourceBucket")

        source_s3_key = d.pop("sourceS3Key")

        create_file_response = cls(
            file_id=file_id,
            upload_url=upload_url,
            source_bucket=source_bucket,
            source_s3_key=source_s3_key,
        )

        create_file_response.additional_properties = d
        return create_file_response

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
