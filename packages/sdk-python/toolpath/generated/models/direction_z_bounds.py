from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="DirectionZBounds")


@_attrs_define
class DirectionZBounds:
    """
    Attributes:
        direction (Vec3):
        z_min (float): Lowest part extent in this direction’s tool-axis frame, in mm.
        z_max (float): Highest part extent in this direction’s tool-axis frame, in mm.
    """

    direction: Vec3
    z_min: float
    z_max: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        direction = self.direction.to_dict()

        z_min = self.z_min

        z_max = self.z_max

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "direction": direction,
                "zMin": z_min,
                "zMax": z_max,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        direction = Vec3.from_dict(d.pop("direction"))

        z_min = d.pop("zMin")

        z_max = d.pop("zMax")

        direction_z_bounds = cls(
            direction=direction,
            z_min=z_min,
            z_max=z_max,
        )

        direction_z_bounds.additional_properties = d
        return direction_z_bounds

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
