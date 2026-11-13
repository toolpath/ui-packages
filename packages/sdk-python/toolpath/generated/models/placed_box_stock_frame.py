from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.placed_box_stock_frame_axis import PlacedBoxStockFrameAxis
    from ..models.placed_box_stock_frame_location import PlacedBoxStockFrameLocation
    from ..models.placed_box_stock_frame_ref_direction import PlacedBoxStockFrameRefDirection


T = TypeVar("T", bound="PlacedBoxStockFrame")


@_attrs_define
class PlacedBoxStockFrame:
    """The frame the corners are measured in, in part coordinates. A point `(x, y, z)` sits at `location + x·refDirection +
    y·(axis × refDirection) + z·axis` on the part.

        Attributes:
            location (PlacedBoxStockFrameLocation): The frame’s origin, in part coordinates, mm.
            axis (PlacedBoxStockFrameAxis): Its z axis, unit length.
            ref_direction (PlacedBoxStockFrameRefDirection): Its x axis, unit length and square to `axis`.
    """

    location: PlacedBoxStockFrameLocation
    axis: PlacedBoxStockFrameAxis
    ref_direction: PlacedBoxStockFrameRefDirection

    def to_dict(self) -> dict[str, Any]:
        location = self.location.to_dict()

        axis = self.axis.to_dict()

        ref_direction = self.ref_direction.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "location": location,
                "axis": axis,
                "refDirection": ref_direction,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.placed_box_stock_frame_axis import PlacedBoxStockFrameAxis
        from ..models.placed_box_stock_frame_location import PlacedBoxStockFrameLocation
        from ..models.placed_box_stock_frame_ref_direction import PlacedBoxStockFrameRefDirection

        d = dict(src_dict)
        location = PlacedBoxStockFrameLocation.from_dict(d.pop("location"))

        axis = PlacedBoxStockFrameAxis.from_dict(d.pop("axis"))

        ref_direction = PlacedBoxStockFrameRefDirection.from_dict(d.pop("refDirection"))

        placed_box_stock_frame = cls(
            location=location,
            axis=axis,
            ref_direction=ref_direction,
        )

        return placed_box_stock_frame
