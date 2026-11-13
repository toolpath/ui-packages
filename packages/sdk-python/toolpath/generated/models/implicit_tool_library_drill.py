from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.implicit_tool_library_drill_inch import ImplicitToolLibraryDrillInch
    from ..models.implicit_tool_library_drill_metric import ImplicitToolLibraryDrillMetric


T = TypeVar("T", bound="ImplicitToolLibraryDrill")


@_attrs_define
class ImplicitToolLibraryDrill:
    """Drills, clipped from the system’s drill series.

    Attributes:
        enabled (bool):
        inch (ImplicitToolLibraryDrillInch | Unset):
        metric (ImplicitToolLibraryDrillMetric | Unset):
    """

    enabled: bool
    inch: ImplicitToolLibraryDrillInch | Unset = UNSET
    metric: ImplicitToolLibraryDrillMetric | Unset = UNSET

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
        from ..models.implicit_tool_library_drill_inch import ImplicitToolLibraryDrillInch
        from ..models.implicit_tool_library_drill_metric import ImplicitToolLibraryDrillMetric

        d = dict(src_dict)
        enabled = d.pop("enabled")

        _inch = d.pop("inch", UNSET)
        inch: ImplicitToolLibraryDrillInch | Unset
        if isinstance(_inch, Unset):
            inch = UNSET
        else:
            inch = ImplicitToolLibraryDrillInch.from_dict(_inch)

        _metric = d.pop("metric", UNSET)
        metric: ImplicitToolLibraryDrillMetric | Unset
        if isinstance(_metric, Unset):
            metric = UNSET
        else:
            metric = ImplicitToolLibraryDrillMetric.from_dict(_metric)

        implicit_tool_library_drill = cls(
            enabled=enabled,
            inch=inch,
            metric=metric,
        )

        return implicit_tool_library_drill
