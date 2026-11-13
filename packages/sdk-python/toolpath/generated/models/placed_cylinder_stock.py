from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..models.placed_cylinder_stock_mode import PlacedCylinderStockMode
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.placed_cylinder_stock_axis import PlacedCylinderStockAxis
    from ..models.placed_cylinder_stock_origin import PlacedCylinderStockOrigin


T = TypeVar("T", bound="PlacedCylinderStock")


@_attrs_define
class PlacedCylinderStock:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    Round stock, or with `innerDiameter` a tube, given where it stands in the part’s coordinates, taken where it lies —
    never sized or squared up — as a plan reports its resolved `cylinder` stock, with `mode` in place of `shape`, so a
    plan’s stock can be sent back. The part must stand inside it, its bore included, or the job fails. Its box, diameter
    × diameter × length, must fit within 2032 × 1270 × 762 mm (80 × 50 × 30 in) in some order.

        Attributes:
            mode (PlacedCylinderStockMode): Round stock, or a tube, given where it stands.
            origin (PlacedCylinderStockOrigin): The center of its base disc, in part coordinates, mm.
            axis (PlacedCylinderStockAxis): Unit vector from the base along the bar, in part coordinates.
            diameter (float): Diameter, mm; positive.
            length (float): Length along `axis`, mm; positive.
            inner_diameter (float | Unset): A tube’s bore, through along `axis`, mm: below `diameter`. Omitted or 0 for
                solid bar.
    """

    mode: PlacedCylinderStockMode
    origin: PlacedCylinderStockOrigin
    axis: PlacedCylinderStockAxis
    diameter: float
    length: float
    inner_diameter: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        origin = self.origin.to_dict()

        axis = self.axis.to_dict()

        diameter = self.diameter

        length = self.length

        inner_diameter = self.inner_diameter

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "mode": mode,
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
        from ..models.placed_cylinder_stock_axis import PlacedCylinderStockAxis
        from ..models.placed_cylinder_stock_origin import PlacedCylinderStockOrigin

        d = dict(src_dict)
        mode = PlacedCylinderStockMode(d.pop("mode"))

        origin = PlacedCylinderStockOrigin.from_dict(d.pop("origin"))

        axis = PlacedCylinderStockAxis.from_dict(d.pop("axis"))

        diameter = d.pop("diameter")

        length = d.pop("length")

        inner_diameter = d.pop("innerDiameter", UNSET)

        placed_cylinder_stock = cls(
            mode=mode,
            origin=origin,
            axis=axis,
            diameter=diameter,
            length=length,
            inner_diameter=inner_diameter,
        )

        return placed_cylinder_stock
