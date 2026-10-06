from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..models.automatic_flat_bar_stock_mode import AutomaticFlatBarStockMode
from ..types import UNSET, Unset

T = TypeVar("T", bound="AutomaticFlatBarStock")


@_attrs_define
class AutomaticFlatBarStock:
    """Automatic Flat Bar: a block sized around the part. Omitted figures take the default; each is at most 762 mm (30 in).
    The block that comes to must fit 2032 × 1270 mm across the cutting direction and 762 mm along it, or the job fails.

        Attributes:
            mode (AutomaticFlatBarStockMode): Flat Bar: a block sized around the part.
            oversize_x (float | Unset): Minimum material on each side of the part along setup x, mm. Default 0.762 (0.03").
            oversize_y (float | Unset): Minimum material on each side of the part along setup y, mm. Default 0.762 (0.03").
            oversize_z_top (float | Unset): Minimum material above the part, mm. Default 0.762 (0.03").
            oversize_z_bottom (float | Unset): Grip stock: exact material below the part, mm. Default 6.35 (1/4").
            snap_x (float | Unset): Width rounding increment, mm; 0 leaves it unrounded. Default 6.35 (1/4").
            snap_y (float | Unset): Depth rounding increment, mm; 0 leaves it unrounded. Default 6.35 (1/4").
            snap_z (float | Unset): Thickness rounding increment, mm; 0 leaves it unrounded. Default 6.35 (1/4").
    """

    mode: AutomaticFlatBarStockMode
    oversize_x: float | Unset = UNSET
    oversize_y: float | Unset = UNSET
    oversize_z_top: float | Unset = UNSET
    oversize_z_bottom: float | Unset = UNSET
    snap_x: float | Unset = UNSET
    snap_y: float | Unset = UNSET
    snap_z: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        oversize_x = self.oversize_x

        oversize_y = self.oversize_y

        oversize_z_top = self.oversize_z_top

        oversize_z_bottom = self.oversize_z_bottom

        snap_x = self.snap_x

        snap_y = self.snap_y

        snap_z = self.snap_z

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "mode": mode,
            }
        )
        if oversize_x is not UNSET:
            field_dict["oversizeX"] = oversize_x
        if oversize_y is not UNSET:
            field_dict["oversizeY"] = oversize_y
        if oversize_z_top is not UNSET:
            field_dict["oversizeZTop"] = oversize_z_top
        if oversize_z_bottom is not UNSET:
            field_dict["oversizeZBottom"] = oversize_z_bottom
        if snap_x is not UNSET:
            field_dict["snapX"] = snap_x
        if snap_y is not UNSET:
            field_dict["snapY"] = snap_y
        if snap_z is not UNSET:
            field_dict["snapZ"] = snap_z

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = AutomaticFlatBarStockMode(d.pop("mode"))

        oversize_x = d.pop("oversizeX", UNSET)

        oversize_y = d.pop("oversizeY", UNSET)

        oversize_z_top = d.pop("oversizeZTop", UNSET)

        oversize_z_bottom = d.pop("oversizeZBottom", UNSET)

        snap_x = d.pop("snapX", UNSET)

        snap_y = d.pop("snapY", UNSET)

        snap_z = d.pop("snapZ", UNSET)

        automatic_flat_bar_stock = cls(
            mode=mode,
            oversize_x=oversize_x,
            oversize_y=oversize_y,
            oversize_z_top=oversize_z_top,
            oversize_z_bottom=oversize_z_bottom,
            snap_x=snap_x,
            snap_y=snap_y,
            snap_z=snap_z,
        )

        return automatic_flat_bar_stock
