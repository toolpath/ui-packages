from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="ToolFitResult")


@_attrs_define
class ToolFitResult:
    """Deprecated: the tool geometry a surface's own shape admits, before the layers are consulted. `BullnoseCurve`
    replaces it, and these figures are its ends. Removed in the next API major.

        Attributes:
            corner_radius (float | Unset): Corner radius the surface shape admits, in mm; absent where the shape limits no
                corner, and then the other two are absent as well.
            tool_diameter (float | Unset): Largest full-diameter tool the surface shape admits, in mm; absent where the
                shape limits no diameter.
            tool_bottom_diameter (float | Unset): Largest bottom diameter the surface shape admits, in mm; absent where the
                shape limits no flat bottom.
    """

    corner_radius: float | Unset = UNSET
    tool_diameter: float | Unset = UNSET
    tool_bottom_diameter: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        corner_radius = self.corner_radius

        tool_diameter = self.tool_diameter

        tool_bottom_diameter = self.tool_bottom_diameter

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if corner_radius is not UNSET:
            field_dict["cornerRadius"] = corner_radius
        if tool_diameter is not UNSET:
            field_dict["toolDiameter"] = tool_diameter
        if tool_bottom_diameter is not UNSET:
            field_dict["toolBottomDiameter"] = tool_bottom_diameter

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        corner_radius = d.pop("cornerRadius", UNSET)

        tool_diameter = d.pop("toolDiameter", UNSET)

        tool_bottom_diameter = d.pop("toolBottomDiameter", UNSET)

        tool_fit_result = cls(
            corner_radius=corner_radius,
            tool_diameter=tool_diameter,
            tool_bottom_diameter=tool_bottom_diameter,
        )

        return tool_fit_result
