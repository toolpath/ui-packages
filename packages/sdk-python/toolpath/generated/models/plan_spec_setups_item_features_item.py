from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..models.plan_spec_setups_item_features_item_feature_type import PlanSpecSetupsItemFeaturesItemFeatureType
from ..types import UNSET, Unset

T = TypeVar("T", bound="PlanSpecSetupsItemFeaturesItem")


@_attrs_define
class PlanSpecSetupsItemFeaturesItem:
    """A feature a setup must machine, named by its regions and, to restate one, its type.

    Attributes:
        regions (list[int]): The feature’s regions, as indices into the part’s `regions`, in any order.
        feature_type (PlanSpecSetupsItemFeaturesItemFeatureType | Unset): The type the regions are read as, in the
            snake_case of a part feature’s `featureType`. State it to restate a feature as it is listed — by the part, or by
            a plan’s `planSpec` — since a type can say more than its regions do: a profile’s regions alone read as a wall.
            Leave it out for regions of your own, such as a listed feature’s regions edited, and they are read as the
            narrowest type they make. Regions that are not the type stated fail the job.
    """

    regions: list[int]
    feature_type: PlanSpecSetupsItemFeaturesItemFeatureType | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        regions = self.regions

        feature_type: str | Unset = UNSET
        if not isinstance(self.feature_type, Unset):
            feature_type = self.feature_type.value

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "regions": regions,
            }
        )
        if feature_type is not UNSET:
            field_dict["featureType"] = feature_type

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        regions = cast(list[int], d.pop("regions"))

        _feature_type = d.pop("featureType", UNSET)
        feature_type: PlanSpecSetupsItemFeaturesItemFeatureType | Unset
        if isinstance(_feature_type, Unset):
            feature_type = UNSET
        else:
            feature_type = PlanSpecSetupsItemFeaturesItemFeatureType(_feature_type)

        plan_spec_setups_item_features_item = cls(
            regions=regions,
            feature_type=feature_type,
        )

        return plan_spec_setups_item_features_item
