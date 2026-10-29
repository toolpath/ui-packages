from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.stock_body_shape import StockBodyShape

T = TypeVar("T", bound="StockBody")


@_attrs_define
class StockBody:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    Initial stock taken where it lies: another body of the part’s own file, never sized or squared up, so no figure is
    reported — the body is the figure.

        Attributes:
            shape (StockBodyShape): A body of the part’s file.
            body_index (int): The stock body’s index among the part’s file’s `bodies`.
            material_free_regions (list[int]): The part’s regions (indices into its report’s `regions`) the stock body
                already leaves at their final surface, ascending. The plan skips them: no setup machines them.
    """

    shape: StockBodyShape
    body_index: int
    material_free_regions: list[int]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        shape = self.shape.value

        body_index = self.body_index

        material_free_regions = self.material_free_regions

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "shape": shape,
                "bodyIndex": body_index,
                "materialFreeRegions": material_free_regions,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        shape = StockBodyShape(d.pop("shape"))

        body_index = d.pop("bodyIndex")

        material_free_regions = cast(list[int], d.pop("materialFreeRegions"))

        stock_body = cls(
            shape=shape,
            body_index=body_index,
            material_free_regions=material_free_regions,
        )

        stock_body.additional_properties = d
        return stock_body

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
