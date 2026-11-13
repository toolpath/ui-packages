from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.stock_cylinder_shape import StockCylinderShape
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="StockCylinder")


@_attrs_define
class StockCylinder:
    """
    Attributes:
        shape (StockCylinderShape): A bar: tells it from a `box`.
        origin (Vec3):
        axis (Vec3):
        diameter (float): Cylinder diameter, mm.
        length (float): Cylinder length along its axis, mm.
        inner_diameter (float | Unset): **Experimental.** Available now and still gaining functionality. It may change
            in breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            A tube’s bore, through along `axis`, mm; absent for solid bar. Only a `placedCylinder` with an `innerDiameter`
            is a tube.
    """

    shape: StockCylinderShape
    origin: Vec3
    axis: Vec3
    diameter: float
    length: float
    inner_diameter: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        shape = self.shape.value

        origin = self.origin.to_dict()

        axis = self.axis.to_dict()

        diameter = self.diameter

        length = self.length

        inner_diameter = self.inner_diameter

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
        if inner_diameter is not UNSET:
            field_dict["innerDiameter"] = inner_diameter

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        shape = StockCylinderShape(d.pop("shape"))

        origin = Vec3.from_dict(d.pop("origin"))

        axis = Vec3.from_dict(d.pop("axis"))

        diameter = d.pop("diameter")

        length = d.pop("length")

        inner_diameter = d.pop("innerDiameter", UNSET)

        stock_cylinder = cls(
            shape=shape,
            origin=origin,
            axis=axis,
            diameter=diameter,
            length=length,
            inner_diameter=inner_diameter,
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
