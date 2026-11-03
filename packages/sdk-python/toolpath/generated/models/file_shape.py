from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="FileShape")


@_attrs_define
class FileShape:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    One shape of a file, and how many it needs.

        Attributes:
            index (int): The shape’s first body, which stands for every copy: the one **Make parts from a file** takes.
            bodies (list[int]): Every body of the file that matches this shape, by `index`, ascending. A match is by mass
                properties, not exact geometry, so check it before quoting from it.
            count (int): How many of this shape one of the file’s assemblies needs: what a quote multiplies by. Today one
                for each of its `bodies`. A body an assembly places more than once is still listed once, and counted once, until
                placements are reported.
    """

    index: int
    bodies: list[int]
    count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        index = self.index

        bodies = self.bodies

        count = self.count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "index": index,
                "bodies": bodies,
                "count": count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        index = d.pop("index")

        bodies = cast(list[int], d.pop("bodies"))

        count = d.pop("count")

        file_shape = cls(
            index=index,
            bodies=bodies,
            count=count,
        )

        file_shape.additional_properties = d
        return file_shape

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
