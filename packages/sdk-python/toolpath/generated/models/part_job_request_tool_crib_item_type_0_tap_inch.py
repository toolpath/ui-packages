from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PartJobRequestToolCribItemType0TapInch")


@_attrs_define
class PartJobRequestToolCribItemType0TapInch:
    """
    Attributes:
        enabled (bool):
        min_diameter (float | Unset):
        max_diameter (float | Unset):
    """

    enabled: bool
    min_diameter: float | Unset = UNSET
    max_diameter: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        min_diameter = self.min_diameter

        max_diameter = self.max_diameter

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "enabled": enabled,
            }
        )
        if min_diameter is not UNSET:
            field_dict["minDiameter"] = min_diameter
        if max_diameter is not UNSET:
            field_dict["maxDiameter"] = max_diameter

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled")

        min_diameter = d.pop("minDiameter", UNSET)

        max_diameter = d.pop("maxDiameter", UNSET)

        part_job_request_tool_crib_item_type_0_tap_inch = cls(
            enabled=enabled,
            min_diameter=min_diameter,
            max_diameter=max_diameter,
        )

        return part_job_request_tool_crib_item_type_0_tap_inch
