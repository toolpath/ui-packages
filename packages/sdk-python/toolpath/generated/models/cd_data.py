from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cd_bounds import CdBounds


T = TypeVar("T", bound="CdData")


@_attrs_define
class CdData:
    """Clearance-diameter bounds per tolerance regime, plus the flags derived with them.

    Attributes:
        ignore (CdBounds): How wide a tool a feature admits — two upper bounds, differing in how much of the
            feature the tool has to reach. `min` is the largest tool that reaches every part of the
            feature, `max` the largest that fits somewhere; `min <= max`, an absent bound counting as
            unbounded, so `min` is absent only where `max` is. Both bounds are absent where nothing
            encloses the feature, as for a facing pass. Both are zero where no tool fits, and
            wherever `CdData.measurementFailed` is set.
        deviate (CdBounds): How wide a tool a feature admits — two upper bounds, differing in how much of the
            feature the tool has to reach. `min` is the largest tool that reaches every part of the
            feature, `max` the largest that fits somewhere; `min <= max`, an absent bound counting as
            unbounded, so `min` is absent only where `max` is. Both bounds are absent where nothing
            encloses the feature, as for a facing pass. Both are zero where no tool fits, and
            wherever `CdData.measurementFailed` is set.
        effective_adaptive (CdBounds): How wide a tool a feature admits — two upper bounds, differing in how much of the
            feature the tool has to reach. `min` is the largest tool that reaches every part of the
            feature, `max` the largest that fits somewhere; `min <= max`, an absent bound counting as
            unbounded, so `min` is absent only where `max` is. Both bounds are absent where nothing
            encloses the feature, as for a facing pass. Both are zero where no tool fits, and
            wherever `CdData.measurementFailed` is set.
        terminal_corner_radius (float | Unset): The corner radius a terminal tool must not exceed, in mm; absent where
            no corner radius
            is too large. On a surface that is where nothing bounds a ball; on every other kind,
            where no blend calls for a corner.
        measurement_failed (bool | Unset): The clearance measurement was owed and failed, so every regime reads zero and
            no tool
            is offered on its strength. Never set on a hole, whose clearance is written down rather
            than measured, or on a facing pass, which owes none. A surface measured in layers sets
            it when every layer that crossed the surface failed. On a chamfer it is the surface
            half's: the tools that follow the bevel are refused, and the cone, which the bevel
            bounds, is still offered and planned.
    """

    ignore: CdBounds
    deviate: CdBounds
    effective_adaptive: CdBounds
    terminal_corner_radius: float | Unset = UNSET
    measurement_failed: bool | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        ignore = self.ignore.to_dict()

        deviate = self.deviate.to_dict()

        effective_adaptive = self.effective_adaptive.to_dict()

        terminal_corner_radius = self.terminal_corner_radius

        measurement_failed = self.measurement_failed

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "ignore": ignore,
                "deviate": deviate,
                "effectiveAdaptive": effective_adaptive,
            }
        )
        if terminal_corner_radius is not UNSET:
            field_dict["terminalCornerRadius"] = terminal_corner_radius
        if measurement_failed is not UNSET:
            field_dict["measurementFailed"] = measurement_failed

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cd_bounds import CdBounds

        d = dict(src_dict)
        ignore = CdBounds.from_dict(d.pop("ignore"))

        deviate = CdBounds.from_dict(d.pop("deviate"))

        effective_adaptive = CdBounds.from_dict(d.pop("effectiveAdaptive"))

        terminal_corner_radius = d.pop("terminalCornerRadius", UNSET)

        measurement_failed = d.pop("measurementFailed", UNSET)

        cd_data = cls(
            ignore=ignore,
            deviate=deviate,
            effective_adaptive=effective_adaptive,
            terminal_corner_radius=terminal_corner_radius,
            measurement_failed=measurement_failed,
        )

        return cd_data
