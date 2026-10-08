from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..models.fixed_cylinder_stock_mode import FixedCylinderStockMode
from ..models.fixed_cylinder_stock_position import FixedCylinderStockPosition
from ..types import UNSET, Unset

T = TypeVar("T", bound="FixedCylinderStock")


@_attrs_define
class FixedCylinderStock:
    """A cylinder of given size, standing along the first setup’s cutting direction and centered on the part’s smallest
    enclosing circle. Its box, diameter × diameter × length, must fit within 80 × 50 × 30 in (2032 × 1270 × 762 mm) in
    some order.

        Attributes:
            mode (FixedCylinderStockMode): A cylinder of the diameter and length given.
            diameter (float): Diameter, mm; positive.
            length (float): Length along the cutting direction, mm; positive.
            position (FixedCylinderStockPosition): Where fixed stock sits along the first setup’s cutting direction.
                `modelCentered` splits the extra length evenly above and below the part and ignores `positionOffset`;
                `offsetFromTop` puts the stock’s top `positionOffset` above the part’s top; `offsetFromBottom` puts the stock’s
                bottom `positionOffset` below the part’s bottom.
            position_offset (float | Unset): Distance for `offsetFromTop` / `offsetFromBottom`, mm; may be negative, between
                -2032 and 2032 (80 in). Omitted means 0.
    """

    mode: FixedCylinderStockMode
    diameter: float
    length: float
    position: FixedCylinderStockPosition
    position_offset: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        diameter = self.diameter

        length = self.length

        position = self.position.value

        position_offset = self.position_offset

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "mode": mode,
                "diameter": diameter,
                "length": length,
                "position": position,
            }
        )
        if position_offset is not UNSET:
            field_dict["positionOffset"] = position_offset

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = FixedCylinderStockMode(d.pop("mode"))

        diameter = d.pop("diameter")

        length = d.pop("length")

        position = FixedCylinderStockPosition(d.pop("position"))

        position_offset = d.pop("positionOffset", UNSET)

        fixed_cylinder_stock = cls(
            mode=mode,
            diameter=diameter,
            length=length,
            position=position,
            position_offset=position_offset,
        )

        return fixed_cylinder_stock
