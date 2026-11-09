from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.file_shape_placement import FileShapePlacement


T = TypeVar("T", bound="FileShape")


@_attrs_define
class FileShape:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    One shape of a file, and how many it needs.

        Attributes:
            index (int): The shape’s first body, which stands for every copy: the one **Make parts from a file** takes.
            bodies (list[int]): Every body of the file that is this shape, by `index`, ascending: the shape’s first body
                alone. On a file inspected before placements were reported, every body that matched it by mass properties, not
                exact geometry (see `FileBody.shape`), so check it before quoting from it.
            placements (list[FileShapePlacement]): **Experimental.** Available now and still gaining functionality. It may
                change in breaking ways in a minor API release; each such change is listed in the release notes, so check them
                before upgrading.

                Every copy of this shape the file holds: one for each place the file’s assemblies put it, in the file’s order.
                The first is where the body was loaded, at the identity placement. A file inspected before placements were
                reported lists each of `bodies` once, each at the identity placement of its own `body`: where its copies sit was
                not read. Listed in full, with no pagination, however many copies a file holds.
            count (int): How many of this shape the file needs: what a quote multiplies by. The length of `placements`, so a
                body an assembly places more than once counts once for each placement.
    """

    index: int
    bodies: list[int]
    placements: list[FileShapePlacement]
    count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        index = self.index

        bodies = self.bodies

        placements = []
        for placements_item_data in self.placements:
            placements_item = placements_item_data.to_dict()
            placements.append(placements_item)

        count = self.count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "index": index,
                "bodies": bodies,
                "placements": placements,
                "count": count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.file_shape_placement import FileShapePlacement

        d = dict(src_dict)
        index = d.pop("index")

        bodies = cast(list[int], d.pop("bodies"))

        placements = []
        _placements = d.pop("placements")
        for placements_item_data in _placements:
            placements_item = FileShapePlacement.from_dict(placements_item_data)

            placements.append(placements_item)

        count = d.pop("count")

        file_shape = cls(
            index=index,
            bodies=bodies,
            placements=placements,
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
