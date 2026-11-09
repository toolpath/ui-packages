from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.file_shape_placement_placement import FileShapePlacementPlacement


T = TypeVar("T", bound="FileShapePlacement")


@_attrs_define
class FileShapePlacement:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    One copy of a shape: which body it is, and where it sits.

        Attributes:
            body (int): The `index` of the body this copy is: one of the shape’s `bodies`.
            placement (FileShapePlacementPlacement): Where this copy sits: a point `p` of `body`, as **Get file mesh** draws
                it, lands at `location + p.x·refDirection + p.y·(axis × refDirection) + p.z·axis`. Absolute, in the file’s
                coordinates, in mm. One of the file’s own assembly placements, so always a rotation and translation, never a
                mirror image or a scale.
    """

    body: int
    placement: FileShapePlacementPlacement
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        body = self.body

        placement = self.placement.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "body": body,
                "placement": placement,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.file_shape_placement_placement import FileShapePlacementPlacement

        d = dict(src_dict)
        body = d.pop("body")

        placement = FileShapePlacementPlacement.from_dict(d.pop("placement"))

        file_shape_placement = cls(
            body=body,
            placement=placement,
        )

        file_shape_placement.additional_properties = d
        return file_shape_placement

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
