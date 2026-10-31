from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.file_shape import FileShape


T = TypeVar("T", bound="CreateFilePartsResponsePartsItem")


@_attrs_define
class CreateFilePartsResponsePartsItem:
    """
    Attributes:
        part_id (UUID): Identifier of the part.
        body_index (int): The `index` of the body the part is.
        created (bool): Whether this request made the part. False when the body was already made a part, which is then
            the part returned: one body of a file is only ever one part.
        shape (FileShape): **Experimental.** Available now and still gaining functionality. It may change in breaking
            ways in a minor API release; each such change is listed in the release notes, so check them before upgrading.

            One shape of a file, and how many it needs.
    """

    part_id: UUID
    body_index: int
    created: bool
    shape: FileShape
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        part_id = str(self.part_id)

        body_index = self.body_index

        created = self.created

        shape = self.shape.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "partId": part_id,
                "bodyIndex": body_index,
                "created": created,
                "shape": shape,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.file_shape import FileShape

        d = dict(src_dict)
        part_id = UUID(d.pop("partId"))

        body_index = d.pop("bodyIndex")

        created = d.pop("created")

        shape = FileShape.from_dict(d.pop("shape"))

        create_file_parts_response_parts_item = cls(
            part_id=part_id,
            body_index=body_index,
            created=created,
            shape=shape,
        )

        create_file_parts_response_parts_item.additional_properties = d
        return create_file_parts_response_parts_item

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
