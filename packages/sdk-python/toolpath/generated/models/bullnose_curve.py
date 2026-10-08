from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="BullnoseCurve")


@_attrs_define
class BullnoseCurve:
    """The tool geometry a surface's own shape admits, before the layers are consulted: at each
    corner radius, the widest flat bottom `D − 2r` a bullnose carrying it may have and still
    reach all of the surface. A tool with corner `r` reaches all of it when its diameter is at
    most `2·rᵢ + bᵢ` at a stored corner `rᵢ`; `2·r + min(bᵢ, bᵢ₊₁)` between two, `rᵢ < r < rᵢ₊₁`,
    since the bottom never widens as the corner grows; and `2·r_last + b_last` past the last.
    An absent bottom limits nothing at its point.

        Attributes:
            corner_radius (list[float | None]): Ascending from zero, the flat, in mm; the last is the largest corner a tool
                reaching all
                of the surface may have. Absent where the shape limits no corner, and then the curve is
                unbounded throughout.
            bottom_diameter (list[float | None]): Widest bottom at each corner, beside it, in mm; absent where the shape
                limits none.
    """

    corner_radius: list[float | None]
    bottom_diameter: list[float | None]

    def to_dict(self) -> dict[str, Any]:
        corner_radius = []
        for corner_radius_item_data in self.corner_radius:
            corner_radius_item: float | None
            corner_radius_item = corner_radius_item_data
            corner_radius.append(corner_radius_item)

        bottom_diameter = []
        for bottom_diameter_item_data in self.bottom_diameter:
            bottom_diameter_item: float | None
            bottom_diameter_item = bottom_diameter_item_data
            bottom_diameter.append(bottom_diameter_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "cornerRadius": corner_radius,
                "bottomDiameter": bottom_diameter,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        corner_radius = []
        _corner_radius = d.pop("cornerRadius")
        for corner_radius_item_data in _corner_radius:

            def _parse_corner_radius_item(data: object) -> float | None:
                if data is None:
                    return data
                return cast(float | None, data)

            corner_radius_item = _parse_corner_radius_item(corner_radius_item_data)

            corner_radius.append(corner_radius_item)

        bottom_diameter = []
        _bottom_diameter = d.pop("bottomDiameter")
        for bottom_diameter_item_data in _bottom_diameter:

            def _parse_bottom_diameter_item(data: object) -> float | None:
                if data is None:
                    return data
                return cast(float | None, data)

            bottom_diameter_item = _parse_bottom_diameter_item(bottom_diameter_item_data)

            bottom_diameter.append(bottom_diameter_item)

        bullnose_curve = cls(
            corner_radius=corner_radius,
            bottom_diameter=bottom_diameter,
        )

        return bullnose_curve
