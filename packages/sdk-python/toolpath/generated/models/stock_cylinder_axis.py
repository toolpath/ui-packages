from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="StockCylinderAxis")


@_attrs_define
class StockCylinderAxis:
    """Unit vector from the base along the bar, in part coordinates: the first setup’s cutting direction for an upright
    bar, the part’s long side for one lying down.

        Attributes:
            x (float): X coordinate or direction component.
            y (float): Y coordinate or direction component.
            z (float): Z coordinate or direction component.
    """

    x: float
    y: float
    z: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        x = self.x

        y = self.y

        z = self.z

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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

        stock_cylinder_axis = cls(
            x=x,
            y=y,
            z=z,
        )

        stock_cylinder_axis.additional_properties = d
        return stock_cylinder_axis

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
