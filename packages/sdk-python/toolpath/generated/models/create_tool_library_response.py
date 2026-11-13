from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="CreateToolLibraryResponse")


@_attrs_define
class CreateToolLibraryResponse:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A new tool library, and where to upload it.

        Attributes:
            tool_library_id (UUID): Identifier of the newly created tool library: what a tool crib names it by.
            upload_url (str): Short-lived URL that accepts a direct upload of the library.
            source_bucket (str): Object-storage bucket receiving the library.
            source_s3_key (str): Object-storage key assigned to the library.
    """

    tool_library_id: UUID
    upload_url: str
    source_bucket: str
    source_s3_key: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        tool_library_id = str(self.tool_library_id)

        upload_url = self.upload_url

        source_bucket = self.source_bucket

        source_s3_key = self.source_s3_key

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "toolLibraryId": tool_library_id,
                "uploadUrl": upload_url,
                "sourceBucket": source_bucket,
                "sourceS3Key": source_s3_key,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        tool_library_id = UUID(d.pop("toolLibraryId"))

        upload_url = d.pop("uploadUrl")

        source_bucket = d.pop("sourceBucket")

        source_s3_key = d.pop("sourceS3Key")

        create_tool_library_response = cls(
            tool_library_id=tool_library_id,
            upload_url=upload_url,
            source_bucket=source_bucket,
            source_s3_key=source_s3_key,
        )

        create_tool_library_response.additional_properties = d
        return create_tool_library_response

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
