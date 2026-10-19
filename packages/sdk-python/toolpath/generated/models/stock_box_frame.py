from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="StockBoxFrame")


@_attrs_define
class StockBoxFrame:
    """The setup frame the corners are measured in, in part coordinates. A point `(x, y, z)` sits at `location +
    x·refDirection + y·(axis × refDirection) + z·axis` on the part.

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

        stock_box_frame = cls(
            location=location,
            axis=axis,
            ref_direction=ref_direction,
        )

        stock_box_frame.additional_properties = d
        return stock_box_frame

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
