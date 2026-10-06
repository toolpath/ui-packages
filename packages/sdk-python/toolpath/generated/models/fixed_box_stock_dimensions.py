from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

T = TypeVar("T", bound="FixedBoxStockDimensions")


@_attrs_define
class FixedBoxStockDimensions:
    """The block’s size, mm; each positive. `x` and `y` are its two sides across the cutting direction, in either order:
    the longer runs along the part’s long side, as the block is loaded, and together they must fit within 2032 × 1270 mm
    (80 × 50 in). `z` is its thickness along the first setup’s cutting direction, at most 762 mm (30 in).

        Attributes:
            x (float):
            y (float):
            z (float):
    """

    x: float
    y: float
    z: float

    def to_dict(self) -> dict[str, Any]:
        x = self.x

        y = self.y

        z = self.z

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "x": x,
                "y": y,
                "z": z,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        x = d.pop("x")

        y = d.pop("y")

        z = d.pop("z")

        fixed_box_stock_dimensions = cls(
            x=x,
            y=y,
            z=z,
        )

        return fixed_box_stock_dimensions
