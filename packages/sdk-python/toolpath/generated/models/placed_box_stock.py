from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..models.placed_box_stock_mode import PlacedBoxStockMode

if TYPE_CHECKING:
    from ..models.placed_box_stock_frame import PlacedBoxStockFrame
    from ..models.placed_box_stock_lower import PlacedBoxStockLower
    from ..models.placed_box_stock_upper import PlacedBoxStockUpper


T = TypeVar("T", bound="PlacedBoxStock")


@_attrs_define
class PlacedBoxStock:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A block given where it stands in the part’s coordinates, taken where it lies — never sized or squared up. It takes
    the fields a plan reports as its resolved `box` stock, with `mode` in place of `shape`, so a plan’s stock can be
    sent back. The part must stand inside it, or the job fails. Its sides must fit within 2032 × 1270 × 762 mm (80 × 50
    × 30 in) in some order.

        Attributes:
            mode (PlacedBoxStockMode): A block given where it stands.
            frame (PlacedBoxStockFrame): The frame the corners are measured in, in part coordinates. A point `(x, y, z)`
                sits at `location + x·refDirection + y·(axis × refDirection) + z·axis` on the part.
            lower (PlacedBoxStockLower): The block’s lower corner, in `frame`, mm.
            upper (PlacedBoxStockUpper): The block’s upper corner, in `frame`, mm: above `lower` along each of its axes.
    """

    mode: PlacedBoxStockMode
    frame: PlacedBoxStockFrame
    lower: PlacedBoxStockLower
    upper: PlacedBoxStockUpper

    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        frame = self.frame.to_dict()

        lower = self.lower.to_dict()

        upper = self.upper.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "mode": mode,
                "frame": frame,
                "lower": lower,
                "upper": upper,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.placed_box_stock_frame import PlacedBoxStockFrame
        from ..models.placed_box_stock_lower import PlacedBoxStockLower
        from ..models.placed_box_stock_upper import PlacedBoxStockUpper

        d = dict(src_dict)
        mode = PlacedBoxStockMode(d.pop("mode"))

        frame = PlacedBoxStockFrame.from_dict(d.pop("frame"))

        lower = PlacedBoxStockLower.from_dict(d.pop("lower"))

        upper = PlacedBoxStockUpper.from_dict(d.pop("upper"))

        placed_box_stock = cls(
            mode=mode,
            frame=frame,
            lower=lower,
            upper=upper,
        )

        return placed_box_stock
