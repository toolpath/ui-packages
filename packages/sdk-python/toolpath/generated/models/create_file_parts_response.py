from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.create_file_parts_response_parts_item import CreateFilePartsResponsePartsItem


T = TypeVar("T", bound="CreateFilePartsResponse")


@_attrs_define
class CreateFilePartsResponse:
    """
    Attributes:
        file_id (UUID): Identifier of the file.
        parts (list[CreateFilePartsResponsePartsItem]): One part for each body named, in the order named.
    """

    file_id: UUID
    parts: list[CreateFilePartsResponsePartsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        file_id = str(self.file_id)

        parts = []
        for parts_item_data in self.parts:
            parts_item = parts_item_data.to_dict()
            parts.append(parts_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fileId": file_id,
                "parts": parts,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_file_parts_response_parts_item import CreateFilePartsResponsePartsItem

        d = dict(src_dict)
        file_id = UUID(d.pop("fileId"))

        parts = []
        _parts = d.pop("parts")
        for parts_item_data in _parts:
            parts_item = CreateFilePartsResponsePartsItem.from_dict(parts_item_data)

            parts.append(parts_item)

        create_file_parts_response = cls(
            file_id=file_id,
            parts=parts,
        )

        create_file_parts_response.additional_properties = d
        return create_file_parts_response

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
