from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="FileThumbnail")


@_attrs_define
class FileThumbnail:
    """
    Attributes:
        body_index (int): The body’s `index` in **Get a file** (`GET /v1/files/{id}`).
        thumbnail_url (str): 15-minute URL for the body’s rendered PNG thumbnail.
    """

    body_index: int
    thumbnail_url: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        body_index = self.body_index

        thumbnail_url = self.thumbnail_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "bodyIndex": body_index,
                "thumbnailUrl": thumbnail_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        body_index = d.pop("bodyIndex")

        thumbnail_url = d.pop("thumbnailUrl")

        file_thumbnail = cls(
            body_index=body_index,
            thumbnail_url=thumbnail_url,
        )

        file_thumbnail.additional_properties = d
        return file_thumbnail

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
