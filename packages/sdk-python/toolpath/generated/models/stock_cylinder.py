from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.stock_cylinder_shape import StockCylinderShape

if TYPE_CHECKING:
    from ..models.stock_cylinder_axis import StockCylinderAxis
    from ..models.stock_cylinder_origin import StockCylinderOrigin


T = TypeVar("T", bound="StockCylinder")


@_attrs_define
class StockCylinder:
    """
    Attributes:
        shape (StockCylinderShape): A bar: tells it from a `box`.
        origin (StockCylinderOrigin): The cylinder’s base center, in part coordinates, mm.
        axis (StockCylinderAxis): Unit vector from the base along the bar, in part coordinates: the first setup’s
            cutting direction for an upright bar, the part’s long side for one lying down.
        diameter (float): Cylinder diameter, mm.
        length (float): Cylinder length along its axis, mm.
    """

    shape: StockCylinderShape
    origin: StockCylinderOrigin
    axis: StockCylinderAxis
    diameter: float
    length: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        shape = self.shape.value

        origin = self.origin.to_dict()

        axis = self.axis.to_dict()

        diameter = self.diameter

        length = self.length

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "shape": shape,
                "origin": origin,
                "axis": axis,
                "diameter": diameter,
                "length": length,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.stock_cylinder_axis import StockCylinderAxis
        from ..models.stock_cylinder_origin import StockCylinderOrigin

        d = dict(src_dict)
        shape = StockCylinderShape(d.pop("shape"))

        origin = StockCylinderOrigin.from_dict(d.pop("origin"))

        axis = StockCylinderAxis.from_dict(d.pop("axis"))

        diameter = d.pop("diameter")

        length = d.pop("length")

        stock_cylinder = cls(
            shape=shape,
            origin=origin,
            axis=axis,
            diameter=diameter,
            length=length,
        )

        stock_cylinder.additional_properties = d
        return stock_cylinder

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
