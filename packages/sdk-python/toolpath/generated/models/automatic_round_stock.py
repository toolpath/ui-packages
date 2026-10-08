from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..models.automatic_round_stock_mode import AutomaticRoundStockMode
from ..types import UNSET, Unset

T = TypeVar("T", bound="AutomaticRoundStock")


@_attrs_define
class AutomaticRoundStock:
    """Automatic Round Stock: a cylinder lying along the part’s long side — or with `verticalAxis`, standing along the
    first setup’s cutting direction — centered on the part’s smallest enclosing circle about that axis and sized around
    it. Omitted figures take the default; each is at most 762 mm (30 in). The bar that comes to must fit within 2032 ×
    1270 × 762 mm in some order as diameter × diameter × length, or the job fails.

        Attributes:
            mode (AutomaticRoundStockMode): Round Stock: a cylinder sized around the part.
            radial_oversize (float | Unset): Minimum material around the part’s smallest enclosing circle, mm. Default 0.762
                (0.03").
            axial_oversize (float | Unset): Front oversize: minimum material past the part’s far end, along the bar, mm.
                Default 0.762 (0.03").
            grip_stock (float | Unset): Exact material between the bar’s base and the part’s near end, mm. Default 6.35
                (1/4").
            dia_round_to_nearest (float | Unset): Diameter rounding increment, mm; 0 leaves it unrounded. Default 6.35
                (1/4").
            length_round_to_nearest (float | Unset): Length rounding increment, mm; 0 leaves it unrounded. Default 6.35
                (1/4").
            vertical_axis (bool | Unset): Stand the bar along the first setup’s cutting direction instead of laying it along
                the part’s long side. Default false: lying down.
    """

    mode: AutomaticRoundStockMode
    radial_oversize: float | Unset = UNSET
    axial_oversize: float | Unset = UNSET
    grip_stock: float | Unset = UNSET
    dia_round_to_nearest: float | Unset = UNSET
    length_round_to_nearest: float | Unset = UNSET
    vertical_axis: bool | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        radial_oversize = self.radial_oversize

        axial_oversize = self.axial_oversize

        grip_stock = self.grip_stock

        dia_round_to_nearest = self.dia_round_to_nearest

        length_round_to_nearest = self.length_round_to_nearest

        vertical_axis = self.vertical_axis

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "mode": mode,
            }
        )
        if radial_oversize is not UNSET:
            field_dict["radialOversize"] = radial_oversize
        if axial_oversize is not UNSET:
            field_dict["axialOversize"] = axial_oversize
        if grip_stock is not UNSET:
            field_dict["gripStock"] = grip_stock
        if dia_round_to_nearest is not UNSET:
            field_dict["diaRoundToNearest"] = dia_round_to_nearest
        if length_round_to_nearest is not UNSET:
            field_dict["lengthRoundToNearest"] = length_round_to_nearest
        if vertical_axis is not UNSET:
            field_dict["verticalAxis"] = vertical_axis

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = AutomaticRoundStockMode(d.pop("mode"))

        radial_oversize = d.pop("radialOversize", UNSET)

        axial_oversize = d.pop("axialOversize", UNSET)

        grip_stock = d.pop("gripStock", UNSET)

        dia_round_to_nearest = d.pop("diaRoundToNearest", UNSET)

        length_round_to_nearest = d.pop("lengthRoundToNearest", UNSET)

        vertical_axis = d.pop("verticalAxis", UNSET)

        automatic_round_stock = cls(
            mode=mode,
            radial_oversize=radial_oversize,
            axial_oversize=axial_oversize,
            grip_stock=grip_stock,
            dia_round_to_nearest=dia_round_to_nearest,
            length_round_to_nearest=length_round_to_nearest,
            vertical_axis=vertical_axis,
        )

        return automatic_round_stock
