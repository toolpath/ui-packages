from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="CdBounds")


@_attrs_define
class CdBounds:
    """How wide a tool a feature admits — two upper bounds, differing in how much of the
    feature the tool has to reach. `min` is the largest tool that reaches every part of the
    feature, `max` the largest that fits somewhere; `min <= max`, an absent bound counting as
    unbounded, so `min` is absent only where `max` is. Both bounds are absent where nothing
    encloses the feature, as for a facing pass. Both are zero where no tool fits, and
    wherever `CdData.measurementFailed` is set.

        Attributes:
            min_ (float | Unset): Largest tool diameter that reaches every point of the feature, in mm; absent where no
                width is too wide to reach all of it.
            max_ (float | Unset): Largest tool diameter that fits somewhere in the feature, in mm; absent where no width
                is too wide to fit.
    """

    min_: float | Unset = UNSET
    max_: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        min_ = self.min_

        max_ = self.max_

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if min_ is not UNSET:
            field_dict["min"] = min_
        if max_ is not UNSET:
            field_dict["max"] = max_

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        min_ = d.pop("min", UNSET)

        max_ = d.pop("max", UNSET)

        cd_bounds = cls(
            min_=min_,
            max_=max_,
        )

        return cd_bounds
