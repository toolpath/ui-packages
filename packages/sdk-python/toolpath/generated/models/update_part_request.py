from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.update_part_request_directions_item import UpdatePartRequestDirectionsItem


T = TypeVar("T", bound="UpdatePartRequest")


@_attrs_define
class UpdatePartRequest:
    """
    Attributes:
        directions (list[UpdatePartRequestDirectionsItem] | Unset): Directions to analyze the part from beyond those the
            directions analysis chose — usually ones from the part’s `discoveredDirections`, passed back exactly as served,
            though any vector within 0.0001 of unit length is taken and normalized. They are added to the part for good:
            this analysis and every later one, and every plan and toolpath calculation, analyze the part from them too, so a
            `setupPlan` can state a setup in one and name its features. Each follows the part’s `candidateDirections` in the
            order added, and every feature the part had keeps its `featureTag`. A direction within 0.1° of one the part has
            adds nothing, and nor does one whose analysis fails; either is missing from the result’s `candidateDirections`.
            A part takes at most 12 added directions in all, and there is no removing one. Omit to analyze the part from the
            directions it has. Example: [{'x': 1, 'y': 0, 'z': 0}].
    """

    directions: list[UpdatePartRequestDirectionsItem] | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        directions: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.directions, Unset):
            directions = []
            for directions_item_data in self.directions:
                directions_item = directions_item_data.to_dict()
                directions.append(directions_item)

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if directions is not UNSET:
            field_dict["directions"] = directions

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_part_request_directions_item import UpdatePartRequestDirectionsItem

        d = dict(src_dict)
        _directions = d.pop("directions", UNSET)
        directions: list[UpdatePartRequestDirectionsItem] | Unset = UNSET
        if _directions is not UNSET:
            directions = []
            for directions_item_data in _directions:
                directions_item = UpdatePartRequestDirectionsItem.from_dict(directions_item_data)

                directions.append(directions_item)

        update_part_request = cls(
            directions=directions,
        )

        return update_part_request
