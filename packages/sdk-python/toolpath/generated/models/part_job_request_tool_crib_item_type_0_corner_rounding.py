from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.part_job_request_tool_crib_item_type_0_corner_rounding_inch import (
        PartJobRequestToolCribItemType0CornerRoundingInch,
    )
    from ..models.part_job_request_tool_crib_item_type_0_corner_rounding_metric import (
        PartJobRequestToolCribItemType0CornerRoundingMetric,
    )


T = TypeVar("T", bound="PartJobRequestToolCribItemType0CornerRounding")


@_attrs_define
class PartJobRequestToolCribItemType0CornerRounding:
    """
    Attributes:
        enabled (bool):
        inch (PartJobRequestToolCribItemType0CornerRoundingInch | Unset):
        metric (PartJobRequestToolCribItemType0CornerRoundingMetric | Unset):
    """

    enabled: bool
    inch: PartJobRequestToolCribItemType0CornerRoundingInch | Unset = UNSET
    metric: PartJobRequestToolCribItemType0CornerRoundingMetric | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        inch: dict[str, Any] | Unset = UNSET
        if not isinstance(self.inch, Unset):
            inch = self.inch.to_dict()

        metric: dict[str, Any] | Unset = UNSET
        if not isinstance(self.metric, Unset):
            metric = self.metric.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "enabled": enabled,
            }
        )
        if inch is not UNSET:
            field_dict["inch"] = inch
        if metric is not UNSET:
            field_dict["metric"] = metric

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.part_job_request_tool_crib_item_type_0_corner_rounding_inch import (
            PartJobRequestToolCribItemType0CornerRoundingInch,
        )
        from ..models.part_job_request_tool_crib_item_type_0_corner_rounding_metric import (
            PartJobRequestToolCribItemType0CornerRoundingMetric,
        )

        d = dict(src_dict)
        enabled = d.pop("enabled")

        _inch = d.pop("inch", UNSET)
        inch: PartJobRequestToolCribItemType0CornerRoundingInch | Unset
        if isinstance(_inch, Unset):
            inch = UNSET
        else:
            inch = PartJobRequestToolCribItemType0CornerRoundingInch.from_dict(_inch)

        _metric = d.pop("metric", UNSET)
        metric: PartJobRequestToolCribItemType0CornerRoundingMetric | Unset
        if isinstance(_metric, Unset):
            metric = UNSET
        else:
            metric = PartJobRequestToolCribItemType0CornerRoundingMetric.from_dict(_metric)

        part_job_request_tool_crib_item_type_0_corner_rounding = cls(
            enabled=enabled,
            inch=inch,
            metric=metric,
        )

        return part_job_request_tool_crib_item_type_0_corner_rounding
