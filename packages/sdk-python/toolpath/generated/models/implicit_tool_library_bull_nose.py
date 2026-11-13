from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.implicit_tool_library_bull_nose_inch import ImplicitToolLibraryBullNoseInch
    from ..models.implicit_tool_library_bull_nose_metric import ImplicitToolLibraryBullNoseMetric


T = TypeVar("T", bound="ImplicitToolLibraryBullNose")


@_attrs_define
class ImplicitToolLibraryBullNose:
    """Bull-nose endmills.

    Attributes:
        enabled (bool):
        inch (ImplicitToolLibraryBullNoseInch | Unset):
        metric (ImplicitToolLibraryBullNoseMetric | Unset):
    """

    enabled: bool
    inch: ImplicitToolLibraryBullNoseInch | Unset = UNSET
    metric: ImplicitToolLibraryBullNoseMetric | Unset = UNSET

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
        from ..models.implicit_tool_library_bull_nose_inch import ImplicitToolLibraryBullNoseInch
        from ..models.implicit_tool_library_bull_nose_metric import ImplicitToolLibraryBullNoseMetric

        d = dict(src_dict)
        enabled = d.pop("enabled")

        _inch = d.pop("inch", UNSET)
        inch: ImplicitToolLibraryBullNoseInch | Unset
        if isinstance(_inch, Unset):
            inch = UNSET
        else:
            inch = ImplicitToolLibraryBullNoseInch.from_dict(_inch)

        _metric = d.pop("metric", UNSET)
        metric: ImplicitToolLibraryBullNoseMetric | Unset
        if isinstance(_metric, Unset):
            metric = UNSET
        else:
            metric = ImplicitToolLibraryBullNoseMetric.from_dict(_metric)

        implicit_tool_library_bull_nose = cls(
            enabled=enabled,
            inch=inch,
            metric=metric,
        )

        return implicit_tool_library_bull_nose
