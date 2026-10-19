from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

T = TypeVar("T", bound="HoleStep")


@_attrs_define
class HoleStep:
    """One cylinder of an axial hole.

    Attributes:
        diameter (float): In mm.
        z_min (float): Where it starts along the axis, in mm.
        z_max (float): Where it ends along the axis, in mm.
    """

    diameter: float
    z_min: float
    z_max: float

    def to_dict(self) -> dict[str, Any]:
        diameter = self.diameter

        z_min = self.z_min

        z_max = self.z_max

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "diameter": diameter,
                "zMin": z_min,
                "zMax": z_max,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        diameter = d.pop("diameter")

        z_min = d.pop("zMin")

        z_max = d.pop("zMax")

        hole_step = cls(
            diameter=diameter,
            z_min=z_min,
            z_max=z_max,
        )

        return hole_step
