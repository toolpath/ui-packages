from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.implicit_tool_library_tap_inch import ImplicitToolLibraryTapInch
    from ..models.implicit_tool_library_tap_metric import ImplicitToolLibraryTapMetric


T = TypeVar("T", bound="ImplicitToolLibraryTap")


@_attrs_define
class ImplicitToolLibraryTap:
    """Every tool that cuts a thread: cutting and forming taps, and thread mills.

    Attributes:
        enabled (bool):
        inch (ImplicitToolLibraryTapInch | Unset):
        metric (ImplicitToolLibraryTapMetric | Unset):
    """

    enabled: bool
    inch: ImplicitToolLibraryTapInch | Unset = UNSET
    metric: ImplicitToolLibraryTapMetric | Unset = UNSET

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
        from ..models.implicit_tool_library_tap_inch import ImplicitToolLibraryTapInch
        from ..models.implicit_tool_library_tap_metric import ImplicitToolLibraryTapMetric

        d = dict(src_dict)
        enabled = d.pop("enabled")

        _inch = d.pop("inch", UNSET)
        inch: ImplicitToolLibraryTapInch | Unset
        if isinstance(_inch, Unset):
            inch = UNSET
        else:
            inch = ImplicitToolLibraryTapInch.from_dict(_inch)

        _metric = d.pop("metric", UNSET)
        metric: ImplicitToolLibraryTapMetric | Unset
        if isinstance(_metric, Unset):
            metric = UNSET
        else:
            metric = ImplicitToolLibraryTapMetric.from_dict(_metric)

        implicit_tool_library_tap = cls(
            enabled=enabled,
            inch=inch,
            metric=metric,
        )

        return implicit_tool_library_tap
