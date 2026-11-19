from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="InsertToolBody")


@_attrs_define
class InsertToolBody:
    """The body the inserts sit on.

    Attributes:
        diameter (float): Nominal diameter, mm (Fusion’s `DC`): where the inserts seat, before any growth over the lead
            angle. The diameter it cuts at is `cuttingDiameter` (`DCX`); a tool the kernel made states the diameter it
            sweeps here and no lead angle, so `cuttingDiameter` is that figure.
        flute_length (float): Axial length that cuts, from the tip, mm.
        pockets (int | Unset): How many insert pockets it has.
    """

    diameter: float
    flute_length: float
    pockets: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        diameter = self.diameter

        flute_length = self.flute_length

        pockets = self.pockets

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "diameter": diameter,
                "fluteLength": flute_length,
            }
        )
        if pockets is not UNSET:
            field_dict["pockets"] = pockets

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        diameter = d.pop("diameter")

        flute_length = d.pop("fluteLength")

        pockets = d.pop("pockets", UNSET)

        insert_tool_body = cls(
            diameter=diameter,
            flute_length=flute_length,
            pockets=pockets,
        )

        insert_tool_body.additional_properties = d
        return insert_tool_body

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
