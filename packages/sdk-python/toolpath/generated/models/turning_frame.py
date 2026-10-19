from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="TurningFrame")


@_attrs_define
class TurningFrame:
    """The half-plane a part is turned in: the axis, and how `(z, r)` lies in part coordinates — the point `location +
    z·direction + r·radial`.

        Attributes:
            direction (Vec3):
            location (Vec3):
            radial (Vec3):
    """

    direction: Vec3
    location: Vec3
    radial: Vec3
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        direction = self.direction.to_dict()

        location = self.location.to_dict()

        radial = self.radial.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "direction": direction,
                "location": location,
                "radial": radial,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        direction = Vec3.from_dict(d.pop("direction"))

        location = Vec3.from_dict(d.pop("location"))

        radial = Vec3.from_dict(d.pop("radial"))

        turning_frame = cls(
            direction=direction,
            location=location,
            radial=radial,
        )

        turning_frame.additional_properties = d
        return turning_frame

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
