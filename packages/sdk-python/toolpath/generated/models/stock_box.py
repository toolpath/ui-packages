from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.stock_box_shape import StockBoxShape

if TYPE_CHECKING:
    from ..models.stock_box_frame import StockBoxFrame
    from ..models.stock_box_lower import StockBoxLower
    from ..models.stock_box_upper import StockBoxUpper


T = TypeVar("T", bound="StockBox")


@_attrs_define
class StockBox:
    """
    Attributes:
        shape (StockBoxShape): A block: tells it from a `cylinder`.
        frame (StockBoxFrame): The setup frame the corners are measured in, in part coordinates. A point `(x, y, z)`
            sits at `location + x·refDirection + y·(axis × refDirection) + z·axis` on the part.
        lower (StockBoxLower): The block’s lower corner, in `frame`, mm.
        upper (StockBoxUpper): The block’s upper corner, in `frame`, mm.
    """

    shape: StockBoxShape
    frame: StockBoxFrame
    lower: StockBoxLower
    upper: StockBoxUpper
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        shape = self.shape.value

        frame = self.frame.to_dict()

        lower = self.lower.to_dict()

        upper = self.upper.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "shape": shape,
                "frame": frame,
                "lower": lower,
                "upper": upper,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.stock_box_frame import StockBoxFrame
        from ..models.stock_box_lower import StockBoxLower
        from ..models.stock_box_upper import StockBoxUpper

        d = dict(src_dict)
        shape = StockBoxShape(d.pop("shape"))

        frame = StockBoxFrame.from_dict(d.pop("frame"))

        lower = StockBoxLower.from_dict(d.pop("lower"))

        upper = StockBoxUpper.from_dict(d.pop("upper"))

        stock_box = cls(
            shape=shape,
            frame=frame,
            lower=lower,
            upper=upper,
        )

        stock_box.additional_properties = d
        return stock_box

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
