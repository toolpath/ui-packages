from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.queue_part_job_response_tool_crib_item_type_0_chamfer_inch import (
        QueuePartJobResponseToolCribItemType0ChamferInch,
    )
    from ..models.queue_part_job_response_tool_crib_item_type_0_chamfer_metric import (
        QueuePartJobResponseToolCribItemType0ChamferMetric,
    )


T = TypeVar("T", bound="QueuePartJobResponseToolCribItemType0Chamfer")


@_attrs_define
class QueuePartJobResponseToolCribItemType0Chamfer:
    """
    Attributes:
        enabled (bool):
        inch (QueuePartJobResponseToolCribItemType0ChamferInch | Unset):
        metric (QueuePartJobResponseToolCribItemType0ChamferMetric | Unset):
    """

    enabled: bool
    inch: QueuePartJobResponseToolCribItemType0ChamferInch | Unset = UNSET
    metric: QueuePartJobResponseToolCribItemType0ChamferMetric | Unset = UNSET

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
        from ..models.queue_part_job_response_tool_crib_item_type_0_chamfer_inch import (
            QueuePartJobResponseToolCribItemType0ChamferInch,
        )
        from ..models.queue_part_job_response_tool_crib_item_type_0_chamfer_metric import (
            QueuePartJobResponseToolCribItemType0ChamferMetric,
        )

        d = dict(src_dict)
        enabled = d.pop("enabled")

        _inch = d.pop("inch", UNSET)
        inch: QueuePartJobResponseToolCribItemType0ChamferInch | Unset
        if isinstance(_inch, Unset):
            inch = UNSET
        else:
            inch = QueuePartJobResponseToolCribItemType0ChamferInch.from_dict(_inch)

        _metric = d.pop("metric", UNSET)
        metric: QueuePartJobResponseToolCribItemType0ChamferMetric | Unset
        if isinstance(_metric, Unset):
            metric = UNSET
        else:
            metric = QueuePartJobResponseToolCribItemType0ChamferMetric.from_dict(_metric)

        queue_part_job_response_tool_crib_item_type_0_chamfer = cls(
            enabled=enabled,
            inch=inch,
            metric=metric,
        )

        return queue_part_job_response_tool_crib_item_type_0_chamfer
