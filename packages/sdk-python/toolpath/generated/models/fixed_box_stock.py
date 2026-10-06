from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..models.fixed_box_stock_mode import FixedBoxStockMode
from ..models.fixed_box_stock_position import FixedBoxStockPosition
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.fixed_box_stock_dimensions import FixedBoxStockDimensions


T = TypeVar("T", bound="FixedBoxStock")


@_attrs_define
class FixedBoxStock:
    """A block of given size, centered on the part across the cutting direction.

    Attributes:
        mode (FixedBoxStockMode): A block of the dimensions given.
        dimensions (FixedBoxStockDimensions): The block’s size, mm; each positive. `x` and `y` are its two sides across
            the cutting direction, in either order: the longer runs along the part’s long side, as the block is loaded, and
            together they must fit within 2032 × 1270 mm (80 × 50 in). `z` is its thickness along the first setup’s cutting
            direction, at most 762 mm (30 in).
        position (FixedBoxStockPosition): Where fixed stock sits along the first setup’s cutting direction.
            `modelCentered` splits the extra length evenly above and below the part and ignores `positionOffset`;
            `offsetFromTop` puts the stock’s top `positionOffset` above the part’s top; `offsetFromBottom` puts the stock’s
            bottom `positionOffset` below the part’s bottom.
        position_offset (float | Unset): Distance for `offsetFromTop` / `offsetFromBottom`, mm; may be negative, between
            -2032 and 2032 (80 in). Omitted means 0.
    """

    mode: FixedBoxStockMode
    dimensions: FixedBoxStockDimensions
    position: FixedBoxStockPosition
    position_offset: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        dimensions = self.dimensions.to_dict()

        position = self.position.value

        position_offset = self.position_offset

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "mode": mode,
                "dimensions": dimensions,
                "position": position,
            }
        )
        if position_offset is not UNSET:
            field_dict["positionOffset"] = position_offset

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.fixed_box_stock_dimensions import FixedBoxStockDimensions

        d = dict(src_dict)
        mode = FixedBoxStockMode(d.pop("mode"))

        dimensions = FixedBoxStockDimensions.from_dict(d.pop("dimensions"))

        position = FixedBoxStockPosition(d.pop("position"))

        position_offset = d.pop("positionOffset", UNSET)

        fixed_box_stock = cls(
            mode=mode,
            dimensions=dimensions,
            position=position,
            position_offset=position_offset,
        )

        return fixed_box_stock
