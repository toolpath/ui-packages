from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.plan_spec_setups_item_direction import PlanSpecSetupsItemDirection
    from ..models.plan_spec_setups_item_features_item import PlanSpecSetupsItemFeaturesItem


T = TypeVar("T", bound="PlanSpecSetupsItem")


@_attrs_define
class PlanSpecSetupsItem:
    """A setup the plan starts with: its direction, and what it must and may machine.

    Attributes:
        direction (PlanSpecSetupsItemDirection): The direction the setup machines from (its tool axis): one of the
            part’s `candidateDirections`, passed back exactly as served.
        exclusive_regions (list[int] | Unset): Regions no other setup may machine. That is all they say: they do not
            make this setup machine them, and one no feature of the setup’s direction holds is refused, since the setup
            cannot reach it. A feature of another direction holding one is planned as what is left of it. Omit for none.
        features (list[PlanSpecSetupsItemFeaturesItem] | Unset): Features the setup must machine, whether or not a tool
            cuts them: a floor, not a ceiling, so the setup machines what else it can. Omit for none.
    """

    direction: PlanSpecSetupsItemDirection
    exclusive_regions: list[int] | Unset = UNSET
    features: list[PlanSpecSetupsItemFeaturesItem] | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        direction = self.direction.to_dict()

        exclusive_regions: list[int] | Unset = UNSET
        if not isinstance(self.exclusive_regions, Unset):
            exclusive_regions = self.exclusive_regions

        features: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.features, Unset):
            features = []
            for features_item_data in self.features:
                features_item = features_item_data.to_dict()
                features.append(features_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "direction": direction,
            }
        )
        if exclusive_regions is not UNSET:
            field_dict["exclusiveRegions"] = exclusive_regions
        if features is not UNSET:
            field_dict["features"] = features

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_spec_setups_item_direction import PlanSpecSetupsItemDirection
        from ..models.plan_spec_setups_item_features_item import PlanSpecSetupsItemFeaturesItem

        d = dict(src_dict)
        direction = PlanSpecSetupsItemDirection.from_dict(d.pop("direction"))

        exclusive_regions = cast(list[int], d.pop("exclusiveRegions", UNSET))

        _features = d.pop("features", UNSET)
        features: list[PlanSpecSetupsItemFeaturesItem] | Unset = UNSET
        if _features is not UNSET:
            features = []
            for features_item_data in _features:
                features_item = PlanSpecSetupsItemFeaturesItem.from_dict(features_item_data)

                features.append(features_item)

        plan_spec_setups_item = cls(
            direction=direction,
            exclusive_regions=exclusive_regions,
            features=features,
        )

        return plan_spec_setups_item
