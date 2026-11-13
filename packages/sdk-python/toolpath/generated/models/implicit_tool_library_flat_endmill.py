from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.implicit_tool_library_flat_endmill_inch import ImplicitToolLibraryFlatEndmillInch
    from ..models.implicit_tool_library_flat_endmill_metric import ImplicitToolLibraryFlatEndmillMetric


T = TypeVar("T", bound="ImplicitToolLibraryFlatEndmill")


@_attrs_define
class ImplicitToolLibraryFlatEndmill:
    """Flat endmills.

    Attributes:
        enabled (bool):
        inch (ImplicitToolLibraryFlatEndmillInch | Unset):
        metric (ImplicitToolLibraryFlatEndmillMetric | Unset):
    """

    enabled: bool
    inch: ImplicitToolLibraryFlatEndmillInch | Unset = UNSET
    metric: ImplicitToolLibraryFlatEndmillMetric | Unset = UNSET

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
        from ..models.implicit_tool_library_flat_endmill_inch import ImplicitToolLibraryFlatEndmillInch
        from ..models.implicit_tool_library_flat_endmill_metric import ImplicitToolLibraryFlatEndmillMetric

        d = dict(src_dict)
        enabled = d.pop("enabled")

        _inch = d.pop("inch", UNSET)
        inch: ImplicitToolLibraryFlatEndmillInch | Unset
        if isinstance(_inch, Unset):
            inch = UNSET
        else:
            inch = ImplicitToolLibraryFlatEndmillInch.from_dict(_inch)

        _metric = d.pop("metric", UNSET)
        metric: ImplicitToolLibraryFlatEndmillMetric | Unset
        if isinstance(_metric, Unset):
            metric = UNSET
        else:
            metric = ImplicitToolLibraryFlatEndmillMetric.from_dict(_metric)

        implicit_tool_library_flat_endmill = cls(
            enabled=enabled,
            inch=inch,
            metric=metric,
        )

        return implicit_tool_library_flat_endmill
