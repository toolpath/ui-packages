from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="InsertToolInsert")


@_attrs_define
class InsertToolInsert:
    """The inserts, as far as the source states them.

    Attributes:
        corner_radius (float | Unset): The insert’s corner radius, mm.
        lead_angle_deg (float | Unset): Angle of the cutting edge to the feed direction, degrees: 90 for a square
            shoulder.
        upper_radius (float | Unset): The round at the top of the insert’s cutting edge, mm (Fusion’s `upper-radius`).
        designation (str | Unset): The insert’s ISO designation, as the catalog states it.
        can_side_mill (bool | Unset): Whether the inserts reach down the periphery to cut a wall; absent is nobody
            having said.
    """

    corner_radius: float | Unset = UNSET
    lead_angle_deg: float | Unset = UNSET
    upper_radius: float | Unset = UNSET
    designation: str | Unset = UNSET
    can_side_mill: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        corner_radius = self.corner_radius

        lead_angle_deg = self.lead_angle_deg

        upper_radius = self.upper_radius

        designation = self.designation

        can_side_mill = self.can_side_mill

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if corner_radius is not UNSET:
            field_dict["cornerRadius"] = corner_radius
        if lead_angle_deg is not UNSET:
            field_dict["leadAngleDeg"] = lead_angle_deg
        if upper_radius is not UNSET:
            field_dict["upperRadius"] = upper_radius
        if designation is not UNSET:
            field_dict["designation"] = designation
        if can_side_mill is not UNSET:
            field_dict["canSideMill"] = can_side_mill

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        corner_radius = d.pop("cornerRadius", UNSET)

        lead_angle_deg = d.pop("leadAngleDeg", UNSET)

        upper_radius = d.pop("upperRadius", UNSET)

        designation = d.pop("designation", UNSET)

        can_side_mill = d.pop("canSideMill", UNSET)

        insert_tool_insert = cls(
            corner_radius=corner_radius,
            lead_angle_deg=lead_angle_deg,
            upper_radius=upper_radius,
            designation=designation,
            can_side_mill=can_side_mill,
        )

        insert_tool_insert.additional_properties = d
        return insert_tool_insert

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
