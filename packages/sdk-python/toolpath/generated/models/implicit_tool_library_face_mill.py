from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.implicit_tool_library_face_mill_inch import ImplicitToolLibraryFaceMillInch
    from ..models.implicit_tool_library_face_mill_metric import ImplicitToolLibraryFaceMillMetric


T = TypeVar("T", bound="ImplicitToolLibraryFaceMill")


@_attrs_define
class ImplicitToolLibraryFaceMill:
    """The one face mill: its diameter.

    Attributes:
        enabled (bool):
        inch (ImplicitToolLibraryFaceMillInch | Unset):
        metric (ImplicitToolLibraryFaceMillMetric | Unset):
    """

    enabled: bool
    inch: ImplicitToolLibraryFaceMillInch | Unset = UNSET
    metric: ImplicitToolLibraryFaceMillMetric | Unset = UNSET

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
        from ..models.implicit_tool_library_face_mill_inch import ImplicitToolLibraryFaceMillInch
        from ..models.implicit_tool_library_face_mill_metric import ImplicitToolLibraryFaceMillMetric

        d = dict(src_dict)
        enabled = d.pop("enabled")

        _inch = d.pop("inch", UNSET)
        inch: ImplicitToolLibraryFaceMillInch | Unset
        if isinstance(_inch, Unset):
            inch = UNSET
        else:
            inch = ImplicitToolLibraryFaceMillInch.from_dict(_inch)

        _metric = d.pop("metric", UNSET)
        metric: ImplicitToolLibraryFaceMillMetric | Unset
        if isinstance(_metric, Unset):
            metric = UNSET
        else:
            metric = ImplicitToolLibraryFaceMillMetric.from_dict(_metric)

        implicit_tool_library_face_mill = cls(
            enabled=enabled,
            inch=inch,
            metric=metric,
        )

        return implicit_tool_library_face_mill
