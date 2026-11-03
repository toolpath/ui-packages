from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="PartFeatureEntryToolFrameType0")


@_attrs_define
class PartFeatureEntryToolFrameType0:
    """The tool frame of the feature’s `machiningDirection`, in part coordinates, returned with `include=contours`: its
    axis is the direction and its x axis level. A contour point `(x, y)` at height `z` sits at `location +
    x·refDirection + y·(axis × refDirection) + z·axis` on the part. Null where `contours` is.

        Attributes:
            location (Vec3):
            axis (Vec3):
            ref_direction (Vec3):
    """

    location: Vec3
    axis: Vec3
    ref_direction: Vec3
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        location = self.location.to_dict()

        axis = self.axis.to_dict()

        ref_direction = self.ref_direction.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "location": location,
                "axis": axis,
                "refDirection": ref_direction,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        location = Vec3.from_dict(d.pop("location"))

        axis = Vec3.from_dict(d.pop("axis"))

        ref_direction = Vec3.from_dict(d.pop("refDirection"))

        part_feature_entry_tool_frame_type_0 = cls(
            location=location,
            axis=axis,
            ref_direction=ref_direction,
        )

        part_feature_entry_tool_frame_type_0.additional_properties = d
        return part_feature_entry_tool_frame_type_0

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
