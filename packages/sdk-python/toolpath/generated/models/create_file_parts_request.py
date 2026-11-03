from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="CreateFilePartsRequest")


@_attrs_define
class CreateFilePartsRequest:
    """
    Attributes:
        bodies (list[int]): The bodies to make parts of, each named once by its `index` among the file’s `bodies`, at
            most 100 to a call. Any body may be named, a copy of another shape included. Example: [0, 2].
    """

    bodies: list[int]

    def to_dict(self) -> dict[str, Any]:
        bodies = self.bodies

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "bodies": bodies,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        bodies = cast(list[int], d.pop("bodies"))

        create_file_parts_request = cls(
            bodies=bodies,
        )

        return create_file_parts_request
