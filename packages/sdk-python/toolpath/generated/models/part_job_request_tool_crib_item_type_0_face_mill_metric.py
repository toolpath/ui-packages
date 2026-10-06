from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PartJobRequestToolCribItemType0FaceMillMetric")


@_attrs_define
class PartJobRequestToolCribItemType0FaceMillMetric:
    """
    Attributes:
        enabled (bool):
        diameter (float | Unset):
    """

    enabled: bool
    diameter: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        diameter = self.diameter

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "enabled": enabled,
            }
        )
        if diameter is not UNSET:
            field_dict["diameter"] = diameter

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled")

        diameter = d.pop("diameter", UNSET)

        part_job_request_tool_crib_item_type_0_face_mill_metric = cls(
            enabled=enabled,
            diameter=diameter,
        )

        return part_job_request_tool_crib_item_type_0_face_mill_metric
