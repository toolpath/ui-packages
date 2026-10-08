from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

T = TypeVar("T", bound="ToleranceBand")


@_attrs_define
class ToleranceBand:
    """How far a machined surface may deviate from the model, in three escalating bands
    (`0 <= ignore <= deviate <= max`, all finite).

        Attributes:
            atol_ignore (float): Deviation at or below this value is ignored, in mm.
            atol_deviate (float): Deviation above the ignored band but at or below this value is reported, in mm.
            atol_max (float): Maximum allowed deviation from the model, in mm.
    """

    atol_ignore: float
    atol_deviate: float
    atol_max: float

    def to_dict(self) -> dict[str, Any]:
        atol_ignore = self.atol_ignore

        atol_deviate = self.atol_deviate

        atol_max = self.atol_max

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "atolIgnore": atol_ignore,
                "atolDeviate": atol_deviate,
                "atolMax": atol_max,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        atol_ignore = d.pop("atolIgnore")

        atol_deviate = d.pop("atolDeviate")

        atol_max = d.pop("atolMax")

        tolerance_band = cls(
            atol_ignore=atol_ignore,
            atol_deviate=atol_deviate,
            atol_max=atol_max,
        )

        return tolerance_band
