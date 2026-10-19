from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

T = TypeVar("T", bound="HoleBottom")


@_attrs_define
class HoleBottom:
    """Where a blind hole ends.

    Attributes:
        z (float): Where the bottom reaches the axis, in mm.
        cone_deg (float): The full apex angle of its cone, in degrees: 180 for a flat bottom.
    """

    z: float
    cone_deg: float

    def to_dict(self) -> dict[str, Any]:
        z = self.z

        cone_deg = self.cone_deg

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "z": z,
                "coneDeg": cone_deg,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        z = d.pop("z")

        cone_deg = d.pop("coneDeg")

        hole_bottom = cls(
            z=z,
            cone_deg=cone_deg,
        )

        return hole_bottom
