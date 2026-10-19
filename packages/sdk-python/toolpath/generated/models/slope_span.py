from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..models.axial_direction import AxialDirection
from ..types import UNSET, Unset

T = TypeVar("T", bound="SlopeSpan")


@_attrs_define
class SlopeSpan:
    """One of a feature's curves, and how steeply it rises and falls along a feed.

    Attributes:
        z_min (float): Where it starts along the axis, in mm.
        z_max (float): Where it ends along the axis, in mm.
        steepest_rise_minus_z_deg (float): The steepest the curve climbs away from the axis, fed toward −z, in degrees.
        steepest_fall_minus_z_deg (float): The steepest the curve drops toward the axis, fed toward −z, in degrees. Fed
            toward +z, rise and fall trade places.
        facing (AxialDirection | Unset): Which way along the axis something looks or comes from.
    """

    z_min: float
    z_max: float
    steepest_rise_minus_z_deg: float
    steepest_fall_minus_z_deg: float
    facing: AxialDirection | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        z_min = self.z_min

        z_max = self.z_max

        steepest_rise_minus_z_deg = self.steepest_rise_minus_z_deg

        steepest_fall_minus_z_deg = self.steepest_fall_minus_z_deg

        facing: str | Unset = UNSET
        if not isinstance(self.facing, Unset):
            facing = self.facing.value

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "zMin": z_min,
                "zMax": z_max,
                "steepestRiseMinusZDeg": steepest_rise_minus_z_deg,
                "steepestFallMinusZDeg": steepest_fall_minus_z_deg,
            }
        )
        if facing is not UNSET:
            field_dict["facing"] = facing

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        z_min = d.pop("zMin")

        z_max = d.pop("zMax")

        steepest_rise_minus_z_deg = d.pop("steepestRiseMinusZDeg")

        steepest_fall_minus_z_deg = d.pop("steepestFallMinusZDeg")

        _facing = d.pop("facing", UNSET)
        facing: AxialDirection | Unset
        if isinstance(_facing, Unset):
            facing = UNSET
        else:
            facing = AxialDirection(_facing)

        slope_span = cls(
            z_min=z_min,
            z_max=z_max,
            steepest_rise_minus_z_deg=steepest_rise_minus_z_deg,
            steepest_fall_minus_z_deg=steepest_fall_minus_z_deg,
            facing=facing,
        )

        return slope_span
