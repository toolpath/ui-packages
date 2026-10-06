from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.queue_part_job_response_tool_crib_item_type_0_drill_inch import (
        QueuePartJobResponseToolCribItemType0DrillInch,
    )
    from ..models.queue_part_job_response_tool_crib_item_type_0_drill_metric import (
        QueuePartJobResponseToolCribItemType0DrillMetric,
    )


T = TypeVar("T", bound="QueuePartJobResponseToolCribItemType0Drill")


@_attrs_define
class QueuePartJobResponseToolCribItemType0Drill:
    """
    Attributes:
        enabled (bool):
        inch (QueuePartJobResponseToolCribItemType0DrillInch | Unset):
        metric (QueuePartJobResponseToolCribItemType0DrillMetric | Unset):
    """

    enabled: bool
    inch: QueuePartJobResponseToolCribItemType0DrillInch | Unset = UNSET
    metric: QueuePartJobResponseToolCribItemType0DrillMetric | Unset = UNSET

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
        from ..models.queue_part_job_response_tool_crib_item_type_0_drill_inch import (
            QueuePartJobResponseToolCribItemType0DrillInch,
        )
        from ..models.queue_part_job_response_tool_crib_item_type_0_drill_metric import (
            QueuePartJobResponseToolCribItemType0DrillMetric,
        )

        d = dict(src_dict)
        enabled = d.pop("enabled")

        _inch = d.pop("inch", UNSET)
        inch: QueuePartJobResponseToolCribItemType0DrillInch | Unset
        if isinstance(_inch, Unset):
            inch = UNSET
        else:
            inch = QueuePartJobResponseToolCribItemType0DrillInch.from_dict(_inch)

        _metric = d.pop("metric", UNSET)
        metric: QueuePartJobResponseToolCribItemType0DrillMetric | Unset
        if isinstance(_metric, Unset):
            metric = UNSET
        else:
            metric = QueuePartJobResponseToolCribItemType0DrillMetric.from_dict(_metric)

        queue_part_job_response_tool_crib_item_type_0_drill = cls(
            enabled=enabled,
            inch=inch,
            metric=metric,
        )

        return queue_part_job_response_tool_crib_item_type_0_drill
